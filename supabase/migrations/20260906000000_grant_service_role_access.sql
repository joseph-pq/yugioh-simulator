-- RLS is bypassed by service_role, but Postgres table privileges still apply.
-- The Edge Function is the sole holder of this role and needs these operations
-- to list, fetch, mutate, and quota-check saved combos.
grant usage on schema public to service_role;
grant select on public.profiles to service_role;
grant select, insert, update, delete on public.combos to service_role;
