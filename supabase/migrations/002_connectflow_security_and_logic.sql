-- ConnectFlow AI – Row Level Security, automation triggers and dashboard stats

-- ---------- RLS on every table ----------
alter table public.cf_businesses          enable row level security;
alter table public.cf_profiles            enable row level security;
alter table public.cf_business_members    enable row level security;
alter table public.cf_business_settings   enable row level security;
alter table public.cf_lead_sources        enable row level security;
alter table public.cf_leads               enable row level security;
alter table public.cf_contact_permissions enable row level security;
alter table public.cf_lists               enable row level security;
alter table public.cf_list_members        enable row level security;
alter table public.cf_message_templates   enable row level security;
alter table public.cf_messages            enable row level security;
alter table public.cf_incoming_replies    enable row level security;
alter table public.cf_call_history        enable row level security;
alter table public.cf_notes               enable row level security;
alter table public.cf_follow_ups          enable row level security;
alter table public.cf_weekly_plans        enable row level security;
alter table public.cf_daily_tasks         enable row level security;
alter table public.cf_activity_logs       enable row level security;

create policy cf_businesses_read on public.cf_businesses for select to authenticated using (public.cf_is_member(id));
create policy cf_members_read on public.cf_business_members for select to authenticated using (user_id = auth.uid());
create policy cf_profiles_self on public.cf_profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy cf_settings_rw on public.cf_business_settings for all to authenticated
  using (public.cf_is_member(business_id)) with check (public.cf_is_member(business_id));

-- Full read/write for members on ordinary business tables
do $$
declare t text;
begin
  foreach t in array array['cf_lead_sources','cf_leads','cf_contact_permissions','cf_lists','cf_list_members',
                           'cf_message_templates','cf_notes','cf_follow_ups','cf_weekly_plans','cf_daily_tasks']
  loop
    execute format('create policy %I on public.%I for all to authenticated using (public.cf_is_member(business_id)) with check (public.cf_is_member(business_id))', t || '_rw', t);
  end loop;
end $$;

-- Call history: read + add only. Never edited or deleted from the app.
create policy cf_calls_read on public.cf_call_history for select to authenticated using (public.cf_is_member(business_id));
create policy cf_calls_insert on public.cf_call_history for insert to authenticated with check (public.cf_is_member(business_id));

-- Messages & replies: members can read; outbound drafts can be inserted. Status updates come from the
-- server (WhatsApp webhook) using the service role, so the app can never fake a "delivered" status.
create policy cf_messages_read on public.cf_messages for select to authenticated using (public.cf_is_member(business_id));
create policy cf_messages_insert on public.cf_messages for insert to authenticated
  with check (public.cf_is_member(business_id) and direction = 'outbound' and status in ('draft','queued'));
create policy cf_replies_read on public.cf_incoming_replies for select to authenticated using (public.cf_is_member(business_id));

-- Activity log: read + append only
create policy cf_activity_read on public.cf_activity_logs for select to authenticated using (public.cf_is_member(business_id));
create policy cf_activity_insert on public.cf_activity_logs for insert to authenticated with check (public.cf_is_member(business_id));

-- ---------- Guards ----------
create or replace function public.cf_block_business_change() returns trigger language plpgsql as $$
begin
  if new.business_id is distinct from old.business_id then
    raise exception 'Records cannot be moved between businesses';
  end if;
  return new;
end $$;
create trigger cf_leads_no_move before update on public.cf_leads for each row execute function public.cf_block_business_change();
create trigger cf_lists_no_move before update on public.cf_lists for each row execute function public.cf_block_business_change();

create or replace function public.cf_block_call_edit() returns trigger language plpgsql as $$
begin
  raise exception 'Call records are permanent and cannot be edited or deleted. Add a new call record instead.';
end $$;
create trigger cf_calls_immutable before update or delete on public.cf_call_history
  for each row when (pg_trigger_depth() = 0) execute function public.cf_block_call_edit();

create or replace function public.cf_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger cf_leads_touch before update on public.cf_leads for each row execute function public.cf_touch_updated_at();

-- ---------- Automation ----------
-- Permission history keeps the lead's current permission in sync
create or replace function public.cf_apply_permission() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update cf_leads set permission_status = new.status where id = new.lead_id and business_id = new.business_id;
  return new;
end $$;
create trigger cf_permission_apply after insert on public.cf_contact_permissions for each row execute function public.cf_apply_permission();

-- A new call record updates the lead status and creates a follow-up reminder
create or replace function public.cf_after_call() returns trigger language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  select lead_status into cur from cf_leads where id = new.lead_id;
  if cur is distinct from 'converted' then
    update cf_leads set lead_status = case
        when new.agreed_one_to_one or new.outcome = 'one_to_one_agreed' then 'call_booked'
        when new.outcome = 'interested' then 'interested'
        when new.outcome = 'requested_info' then 'requested_info'
        when new.outcome = 'follow_up_required' then 'follow_up'
        when new.outcome = 'not_interested' then 'not_interested'
        else lead_status end
      where id = new.lead_id;
  end if;
  if new.next_follow_up is not null then
    insert into cf_follow_ups (business_id, lead_id, due_date, reason, source_call_id)
    values (new.business_id, new.lead_id, new.next_follow_up, coalesce(nullif(new.discussion_notes,''), 'Follow-up from call'), new.id);
  end if;
  return new;
end $$;
create trigger cf_call_after after insert on public.cf_call_history for each row execute function public.cf_after_call();

-- Activity log entries are written by the database itself, so the feed is always real
create or replace function public.cf_log_activity() returns trigger language plpgsql security definer set search_path = public as $$
declare label text; bid uuid; eid uuid;
begin
  bid := new.business_id;
  if tg_table_name = 'cf_leads' then
    label := 'Lead added: ' || coalesce(new.name, new.phone, 'unnamed'); eid := new.id;
  elsif tg_table_name = 'cf_lists' then
    label := 'List created: ' || new.name; eid := new.id;
  elsif tg_table_name = 'cf_call_history' then
    label := 'Call logged (' || replace(new.outcome, '_', ' ') || ') with ' ||
             coalesce((select coalesce(name, phone) from cf_leads where id = new.lead_id), 'a lead');
    eid := new.lead_id;
  elsif tg_table_name = 'cf_messages' then
    label := case when new.direction = 'inbound' then 'Reply received from ' else 'Message prepared for ' end ||
             coalesce((select coalesce(name, phone) from cf_leads where id = new.lead_id), 'a lead');
    eid := new.lead_id;
  elsif tg_table_name = 'cf_notes' then
    label := 'Note added for ' || coalesce((select coalesce(name, phone) from cf_leads where id = new.lead_id), 'a lead');
    eid := new.lead_id;
  end if;
  insert into cf_activity_logs (business_id, actor, action, entity, entity_id)
  values (bid, auth.uid(), label, tg_table_name, eid);
  return new;
end $$;
create trigger cf_log_leads after insert on public.cf_leads for each row execute function public.cf_log_activity();
create trigger cf_log_lists after insert on public.cf_lists for each row execute function public.cf_log_activity();
create trigger cf_log_calls after insert on public.cf_call_history for each row execute function public.cf_log_activity();
create trigger cf_log_messages after insert on public.cf_messages for each row execute function public.cf_log_activity();
create trigger cf_log_notes after insert on public.cf_notes for each row execute function public.cf_log_activity();

-- ---------- Dashboard stats (counted live from real records) ----------
create or replace function public.cf_dashboard_stats(bid uuid)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare result jsonb;
begin
  if not public.cf_is_member(bid) then raise exception 'Not allowed'; end if;
  select jsonb_build_object(
    'total_leads',       (select count(*) from cf_leads where business_id = bid),
    'messages_sent',     (select count(*) from cf_messages where business_id = bid and direction='outbound' and status in ('sent','delivered','read')),
    'messages_delivered',(select count(*) from cf_messages where business_id = bid and direction='outbound' and status in ('delivered','read')),
    'replies_received',  (select count(*) from cf_messages where business_id = bid and direction='inbound'),
    'not_replied',       (select count(distinct m.lead_id) from cf_messages m
                            where m.business_id = bid and m.direction='outbound' and m.status in ('sent','delivered','read')
                              and not exists (select 1 from cf_messages r where r.lead_id = m.lead_id and r.direction='inbound')),
    'interested',        (select count(*) from cf_leads where business_id = bid and lead_status in ('interested','call_booked')),
    'calls_booked',      (select count(*) from cf_leads where business_id = bid and lead_status = 'call_booked'),
    'followups_pending', (select count(*) from cf_follow_ups where business_id = bid and status = 'pending'),
    'converted',         (select count(*) from cf_leads where business_id = bid and lead_status = 'converted'),
    'weekly', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', to_char(d, 'Dy DD'),
        'leads', (select count(*) from cf_leads where business_id = bid and created_at::date = d),
        'messages', (select count(*) from cf_messages where business_id = bid and direction='outbound' and status in ('sent','delivered','read') and coalesce(sent_at, created_at)::date = d),
        'replies', (select count(*) from cf_messages where business_id = bid and direction='inbound' and created_at::date = d),
        'calls', (select count(*) from cf_call_history where business_id = bid and called_at::date = d)
      ) order by d), '[]'::jsonb)
      from generate_series((now() at time zone 'Asia/Kolkata')::date - 6, (now() at time zone 'Asia/Kolkata')::date, interval '1 day') g(d0),
           lateral (select g.d0::date as d) x
    )
  ) into result;
  return result;
end $$;

revoke execute on function public.cf_claim_workspaces() from anon;
revoke execute on function public.cf_dashboard_stats(uuid) from anon;
