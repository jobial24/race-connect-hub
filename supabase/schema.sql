-- Race Connect Hub · esquema de Supabase
-- Pégalo en Supabase → SQL Editor → New query → Run (se puede ejecutar varias veces).

-- 1) Perfiles (nombre visible y token del calendario suscribible)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  calendar_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "perfil: ver el mio" on public.profiles;
create policy "perfil: ver el mio" on public.profiles for select using (auth.uid() = id);
drop policy if exists "perfil: crear el mio" on public.profiles;
create policy "perfil: crear el mio" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "perfil: editar el mio" on public.profiles;
create policy "perfil: editar el mio" on public.profiles for update using (auth.uid() = id);

-- Crear el perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) Mis inscripciones (una fila por carrera; los detalles van en "data")
create table if not exists public.signups (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  race_id text,
  race_date date,
  is_public boolean not null default true,  -- ¿aparezco en "Quién va"?
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists signups_race_idx on public.signups (race_id);
alter table public.signups enable row level security;

drop policy if exists "inscripciones: las mias" on public.signups;
create policy "inscripciones: las mias" on public.signups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) ¿Quién va? Solo nombre visible y distancia de las inscripciones públicas
create or replace function public.race_attendees(p_race_ids text[])
returns table (race_id text, display_name text, distance text)
language sql stable security definer set search_path = public as $$
  select s.race_id,
         coalesce(nullif(p.display_name, ''), 'Corredor/a'),
         s.data->>'distance'
  from public.signups s
  left join public.profiles p on p.id = s.user_id
  where s.is_public
    and s.race_id = any(p_race_ids)
    and (s.race_date is null or s.race_date >= current_date)
$$;
revoke all on function public.race_attendees(text[]) from public;
grant execute on function public.race_attendees(text[]) to authenticated;

-- 4) Calendario suscribible: el enlace secreto (token) devuelve tus carreras
create or replace function public.calendar_feed(p_token uuid)
returns setof jsonb
language sql stable security definer set search_path = public as $$
  select s.data
  from public.signups s
  join public.profiles p on p.id = s.user_id
  where p.calendar_token = p_token
  order by s.race_date
$$;
revoke all on function public.calendar_feed(uuid) from public;
grant execute on function public.calendar_feed(uuid) to anon, authenticated;

-- 5) Perfiles para usuarios que ya existían antes de este script
insert into public.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;
