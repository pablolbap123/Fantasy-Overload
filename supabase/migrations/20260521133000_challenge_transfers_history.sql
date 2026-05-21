create table if not exists public.challenge_transfers (
  id uuid primary key default gen_random_uuid(),
  challenge_transfer_key text not null unique,
  player_id uuid not null references public.players(id) on delete cascade,
  from_team_id uuid references public.teams(id) on delete set null,
  to_team_id uuid references public.teams(id) on delete set null,
  transfer_date timestamptz not null,
  effective_matchday integer,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.player_team_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  from_date timestamptz,
  to_date timestamptz,
  from_matchday integer,
  to_matchday integer,
  source text not null default 'challenge',
  created_at timestamptz not null default now(),
  unique (player_id, team_id, from_date)
);

alter table public.challenge_transfers enable row level security;
alter table public.player_team_history enable row level security;

drop policy if exists challenge_transfers_read_member on public.challenge_transfers;
create policy challenge_transfers_read_member on public.challenge_transfers
for select using (auth.uid() is not null);

drop policy if exists player_team_history_read_member on public.player_team_history;
create policy player_team_history_read_member on public.player_team_history
for select using (auth.uid() is not null);
