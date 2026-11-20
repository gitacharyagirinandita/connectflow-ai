-- Owner choice: every signed-up user joins both workspaces. First person = owner, others = member.
create or replace function public.cf_claim_workspaces()
returns text language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if auth.uid() is null then return 'not_signed_in'; end if;
  if exists (select 1 from cf_business_members where user_id = auth.uid()) then return 'already_member'; end if;
  r := case when exists (select 1 from cf_business_members) then 'member' else 'owner' end;
  insert into cf_business_members (business_id, user_id, role)
    select id, auth.uid(), r from cf_businesses
  on conflict do nothing;
  insert into cf_profiles (id) values (auth.uid()) on conflict do nothing;
  return case when r = 'owner' then 'claimed' else 'joined' end;
end $$;
revoke execute on function public.cf_claim_workspaces() from anon, public;
grant execute on function public.cf_claim_workspaces() to authenticated;
