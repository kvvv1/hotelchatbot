-- ============================================================
-- 001_leads_and_messages.sql
-- Leads (central da operação) e mensagens
-- ============================================================

-- Leads
create table leads (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  guest_phone text not null,
  guest_name text,
  status text not null default 'active' check (
    status in ('active', 'waiting_guest', 'waiting_human', 'human_active', 'closed')
  ),
  stage text not null default 'new_contact' check (
    stage in (
      'new_contact',
      'in_attendance',
      'checking_availability',
      'proposal_sent',
      'negotiating',
      'booking_in_progress',
      'booked',
      'not_converted'
    )
  ),
  bot_enabled boolean not null default true,
  context jsonb not null default '{}',
  assigned_to uuid references profiles(id) on delete set null,
  notes text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (hotel_id, guest_phone)
);

alter table leads enable row level security;

create policy "Hotel members can manage leads"
  on leads for all
  using (
    hotel_id in (
      select hotel_id from profiles where id = auth.uid()
    )
  );

create index leads_hotel_id_idx on leads(hotel_id);
create index leads_status_idx on leads(status);
create index leads_stage_idx on leads(stage);
create index leads_last_message_at_idx on leads(last_message_at desc);

-- Messages
create table messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  sender text not null check (sender in ('guest', 'bot', 'human')),
  content text not null,
  media_type text not null default 'text' check (media_type in ('text', 'audio', 'image', 'video', 'document')),
  media_url text,
  transcription text,
  zapi_message_id text,
  created_at timestamptz not null default now()
);

alter table messages enable row level security;

create policy "Hotel members can read messages"
  on messages for select
  using (
    lead_id in (
      select id from leads where hotel_id in (
        select hotel_id from profiles where id = auth.uid()
      )
    )
  );

create policy "Hotel members can insert messages"
  on messages for insert
  with check (
    lead_id in (
      select id from leads where hotel_id in (
        select hotel_id from profiles where id = auth.uid()
      )
    )
  );

create index messages_lead_id_idx on messages(lead_id);
create index messages_created_at_idx on messages(created_at);
create index messages_zapi_message_id_idx on messages(zapi_message_id) where zapi_message_id is not null;
