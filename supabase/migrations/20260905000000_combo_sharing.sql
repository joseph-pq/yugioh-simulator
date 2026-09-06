-- Combo sharing is intentionally server-mediated. Browser roles have no table access;
-- the Edge Function uses the service role after it verifies the caller's Supabase JWT.
create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.combos (
  slug varchar(12) primary key check (slug ~ '^[A-Za-z0-9]{12}$'),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title varchar(80) not null check (char_length(trim(title)) > 0),
  visibility varchar(12) not null check (visibility in ('public', 'unlisted')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (octet_length(payload::text) <= 65536),
  check ((jsonb_typeof(payload -> 'main') = 'array') is true),
  check ((jsonb_typeof(payload -> 'extra') = 'array') is true),
  check (not (payload ? 'combo') or ((jsonb_typeof(payload -> 'combo') = 'array') is true and jsonb_array_length(payload -> 'combo') <= 100))
);

create index combos_owner_updated_idx on public.combos (owner_id, updated_at desc);

create table private.combo_rate_limits (
  scope varchar(8) not null check (scope in ('user', 'ip')),
  scope_key text not null,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  primary key (scope, scope_key, window_start)
);

create or replace function private.create_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.create_profile();

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger combos_touch_updated_at
  before update on public.combos
  for each row execute procedure private.touch_updated_at();

create or replace function private.base62_slug()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  value text := '';
begin
  for i in 1..12 loop
    value := value || substr(alphabet, floor(random() * length(alphabet) + 1)::integer, 1);
  end loop;
  return value;
end;
$$;

create or replace function private.claim_rate_limit(p_scope varchar, p_scope_key text, p_limit integer)
returns void
language plpgsql
security definer
set search_path = private, public
as $$
declare
  bucket timestamptz := date_trunc('hour', now());
begin
  insert into private.combo_rate_limits (scope, scope_key, window_start, count)
  values (p_scope, p_scope_key, bucket, 1)
  on conflict (scope, scope_key, window_start) do update
    set count = private.combo_rate_limits.count + 1
    where private.combo_rate_limits.count < p_limit;

  if not found then
    raise exception 'Rate limit reached. Please try again later.' using errcode = 'P0001';
  end if;
end;
$$;

-- This function is in the exposed schema solely so the server-side PostgREST
-- client can call it. Browser roles have EXECUTE revoked below.
create or replace function public.create_combo(
  p_owner uuid,
  p_ip_hash text,
  p_title text,
  p_visibility text,
  p_payload jsonb
)
returns setof public.combos
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_slug text;
  v_combo public.combos;
begin
  if p_title is null or char_length(trim(p_title)) = 0 or char_length(p_title) > 80 then
    raise exception 'Title must be between 1 and 80 characters.' using errcode = 'P0001';
  end if;
  if p_visibility not in ('public', 'unlisted') then
    raise exception 'Invalid combo visibility.' using errcode = 'P0001';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(p_payload -> 'main') is distinct from 'array' or jsonb_typeof(p_payload -> 'extra') is distinct from 'array' or (p_payload ? 'combo' and jsonb_typeof(p_payload -> 'combo') is distinct from 'array') then
    raise exception 'Invalid combo payload.' using errcode = 'P0001';
  end if;
  if octet_length(p_payload::text) > 65536 or (p_payload ? 'combo' and jsonb_array_length(p_payload -> 'combo') > 100) then
    raise exception 'Combo payload exceeds publishing limits.' using errcode = 'P0001';
  end if;

  -- Serializes each user's create requests, making the 25-combo quota race-safe.
  perform 1 from public.profiles where id = p_owner for update;
  if not found then raise exception 'Profile not found.' using errcode = 'P0001'; end if;
  if (select count(*) from public.combos where owner_id = p_owner) >= 25 then
    raise exception 'You have reached the 25 saved-combo limit.' using errcode = 'P0001';
  end if;

  perform private.claim_rate_limit('user', p_owner::text, 10);
  perform private.claim_rate_limit('ip', p_ip_hash, 30);

  for attempt in 1..5 loop
    v_slug := private.base62_slug();
    begin
      insert into public.combos (slug, owner_id, title, visibility, payload)
      values (v_slug, p_owner, trim(p_title), p_visibility, p_payload)
      returning * into v_combo;
      return next v_combo;
      return;
    exception when unique_violation then
      -- An extremely unlikely slug collision; generate another one.
    end;
  end loop;
  raise exception 'Could not allocate a short link. Please retry.' using errcode = 'P0001';
end;
$$;

alter table public.profiles enable row level security;
alter table public.combos enable row level security;
revoke all on public.profiles, public.combos from anon, authenticated;
revoke all on schema private from public;
revoke all on all functions in schema private from public;
revoke all on function public.create_combo(uuid, text, text, text, jsonb) from public;
grant usage on schema public to anon, authenticated;
-- Only the Edge Function's service role may call the private creation function.
grant execute on function public.create_combo(uuid, text, text, text, jsonb) to service_role;
