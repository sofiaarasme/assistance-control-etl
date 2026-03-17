create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nombre text not null,
  role text not null check (role in ('admin', 'departamento')),
  departamento text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute procedure public.set_profiles_updated_at();

alter table public.profiles enable row level security;

-- Usuarios autenticados pueden ver su propio perfil
create policy if not exists "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

-- Service role maneja inserción/actualización/borrado vía backend.

-- Seed opcional para primer admin (reemplazar uuid/email/nombre)
-- insert into public.profiles (id, email, nombre, role, departamento, activo)
-- values ('<AUTH_USER_UUID>', 'admin@serimar.com', 'Administrador', 'admin', null, true)
-- on conflict (id) do update set
--   email = excluded.email,
--   nombre = excluded.nombre,
--   role = excluded.role,
--   departamento = excluded.departamento,
--   activo = excluded.activo;
