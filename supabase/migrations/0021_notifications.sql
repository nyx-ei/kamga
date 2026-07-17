-- Ticket #24: in-app notification center.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (
    type in (
      'new_call_to_contribute',
      'payment_reminder',
      'payment_confirmation',
      'join_request_submitted',
      'join_request_approved',
      'join_request_declined',
      'levee_dispatched',
      'collection_milestone'
    )
  ),
  title text not null,
  body text not null,
  href text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_at_idx on public.notifications(recipient_user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(recipient_user_id) where read_at is null;
create index if not exists notifications_type_idx on public.notifications(type);

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
on public.notifications
for select
to authenticated
using (recipient_user_id = auth.uid());

drop policy if exists "Users can update own notification read state" on public.notifications;
create policy "Users can update own notification read state"
on public.notifications
for update
to authenticated
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());
