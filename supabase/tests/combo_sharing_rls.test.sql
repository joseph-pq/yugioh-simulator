begin;
select plan(6);

select has_table('public', 'combos', 'combos table exists');
select row_security_active('public.combos'::regclass), 'RLS is enabled for combos';
select table_privs_are('anon', 'public', 'combos', array[]::text[], 'anonymous browser role has no direct combo privileges');
select table_privs_are('authenticated', 'public', 'combos', array[]::text[], 'authenticated browser role has no direct combo privileges');
select function_privs_are('authenticated', 'public', 'create_combo', array['uuid', 'text', 'text', 'text', 'jsonb'], array[]::text[], 'only the server role can create combos');
select table_privs_are('service_role', 'public', 'combos', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'service role can operate the backend combo boundary');

select * from finish();
rollback;
