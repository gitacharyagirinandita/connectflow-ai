-- Trigger functions should never be callable directly through the API
revoke execute on function public.cf_after_call() from public, anon, authenticated;
revoke execute on function public.cf_apply_permission() from public, anon, authenticated;
revoke execute on function public.cf_log_activity() from public, anon, authenticated;
revoke execute on function public.cf_is_member(uuid) from public, anon;
grant execute on function public.cf_is_member(uuid) to authenticated;
