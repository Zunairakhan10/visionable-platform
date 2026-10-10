create table if not exists public.monitoring_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id text not null,
  type text not null,
  timestamp timestamptz not null,
  severity text not null,
  status text not null,
  review_action text check (review_action is null or review_action in ('no_issue', 'escalated')),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.monitoring_events enable row level security;

drop policy if exists "allow_public_read" on public.monitoring_events;
drop policy if exists "allow_public_insert" on public.monitoring_events;
drop policy if exists "allow_public_update" on public.monitoring_events;
drop policy if exists "allow_public_delete" on public.monitoring_events;

revoke all on table public.monitoring_events from public, anon, authenticated;
grant all on table public.monitoring_events to service_role;
