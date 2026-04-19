-- ============================================================
-- 000_base_tables.sql
-- Tabelas base: hotels e profiles
-- ============================================================

create extension if not exists "pgcrypto";

-- Hotels (equivalente a clinics no doctorchatbot_)
create table hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  zapi_instance_id text,
  zapi_token text,
  zapi_client_token text,
  created_at timestamptz not null default now()
);

-- Profiles (equipe do hotel)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  hotel_id uuid references hotels(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'attendant' check (role in ('admin', 'attendant')),
  created_at timestamptz not null default now()
);

-- Row Level Security for hotels
alter table hotels enable row level security;

create policy "Hotel members can read their hotel"
  on hotels for select
  using (
    id in (
      select hotel_id from profiles where id = auth.uid()
    )
  );

create policy "Hotel admins can update their hotel"
  on hotels for update
  using (
    id in (
      select hotel_id from profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Row Level Security for profiles
alter table profiles enable row level security;

create policy "Users can read profiles in their hotel"
  on profiles for select
  using (
    hotel_id in (
      select hotel_id from profiles where id = auth.uid()
    )
  );

create policy "Users can update their own profile"
  on profiles for update
  using (id = auth.uid());

-- Trigger: create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
