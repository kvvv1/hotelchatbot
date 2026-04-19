-- ============================================================
-- 002_bot_settings.sql
-- Configurações do agente IA por hotel
-- ============================================================

create table bot_settings (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null unique references hotels(id) on delete cascade,
  enabled boolean not null default true,
  system_prompt text,
  hotel_name text not null default '',
  hotel_description text,
  working_hours jsonb not null default '{
    "enabled": false,
    "timezone": "America/Sao_Paulo",
    "days": []
  }',
  auto_transfer_after_messages int not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table bot_settings enable row level security;

create policy "Hotel members can read bot settings"
  on bot_settings for select
  using (
    hotel_id in (
      select hotel_id from profiles where id = auth.uid()
    )
  );

create policy "Hotel admins can update bot settings"
  on bot_settings for all
  using (
    hotel_id in (
      select hotel_id from profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Trigger: updated_at
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger bot_settings_updated_at
  before update on bot_settings
  for each row execute procedure update_updated_at_column();
