-- ============================================================
-- 003_notifications.sql
-- Notificações para a equipe do hotel
-- ============================================================

create table notifications (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  type text not null check (
    type in (
      'new_lead',
      'lead_waiting_human',
      'human_requested',
      'lead_updated',
      'message_received'
    )
  ),
  title text not null,
  message text not null,
  lead_id uuid references leads(id) on delete set null,
  read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

create policy "Users can read their notifications"
  on notifications for select
  using (user_id = auth.uid() or (
    hotel_id in (
      select hotel_id from profiles where id = auth.uid() and role = 'admin'
    ) and user_id is null
  ));

create policy "Users can update their notifications"
  on notifications for update
  using (user_id = auth.uid());

create index notifications_user_id_idx on notifications(user_id);
create index notifications_hotel_id_idx on notifications(hotel_id);
create index notifications_read_idx on notifications(read) where read = false;
create index notifications_created_at_idx on notifications(created_at desc);
