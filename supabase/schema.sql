create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  username text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null unique,
  color text not null default '#38bdf8',
  badge_url text,
  strength integer not null default 75,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  team_id uuid not null references public.teams(id) on delete cascade,
  position text not null check (position in ('POR', 'DEF', 'MED', 'DEL')),
  base_price numeric not null default 1000000 check (base_price >= 0),
  current_price numeric not null default 1000000 check (current_price >= 0),
  fantasy_value numeric not null default 0,
  status text not null default 'disponible' check (status in ('disponible', 'lesionado', 'sancionado', 'duda')),
  total_points integer not null default 0,
  points_by_matchday jsonb not null default '{}'::jsonb,
  stats_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  initial_budget numeric not null default 150000000 check (initial_budget >= 0),
  max_members integer not null default 12 check (max_members between 2 and 100),
  current_matchday integer not null default 1,
  market_locked boolean not null default false,
  lineups_locked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  budget numeric not null default 0 check (budget >= 0),
  total_points integer not null default 0,
  last_matchday_points integer not null default 0,
  points_by_matchday jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create table if not exists public.league_players (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  owner_user_id uuid references public.profiles(user_id) on delete set null,
  listed_by_user_id uuid references public.profiles(user_id) on delete set null,
  market_status text not null default 'market' check (market_status in ('market', 'owned', 'locked')),
  price numeric not null check (price >= 0),
  release_clause numeric not null default 0 check (release_clause >= 0),
  market_listed_at timestamptz,
  market_expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (league_id, player_id)
);

create table if not exists public.official_matchdays (
  number integer primary key check (number > 0),
  name text not null,
  status text not null default 'finalizada' check (status in ('pendiente', 'en_curso', 'finalizada')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz
);

create table if not exists public.official_matches (
  challenge_match_id text primary key,
  matchday_number integer not null references public.official_matchdays(number) on delete cascade,
  home_team_short_name text not null,
  away_team_short_name text not null,
  home_score integer,
  away_score integer,
  status text not null default 'finalizada' check (status in ('pendiente', 'en_curso', 'finalizada')),
  played_at timestamptz not null default now(),
  events_json jsonb not null default '[]'::jsonb,
  player_stats_json jsonb not null default '[]'::jsonb
);

create table if not exists public.squads (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  acquired_price numeric not null check (acquired_price >= 0),
  acquired_at timestamptz not null default now(),
  unique (league_id, user_id, player_id)
);

create table if not exists public.matchdays (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  number integer not null check (number > 0),
  status text not null default 'pendiente' check (status in ('pendiente', 'en_curso', 'finalizada')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  unique (league_id, number)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  matchday_id uuid not null references public.matchdays(id) on delete cascade,
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  home_score integer,
  away_score integer,
  status text not null default 'pendiente' check (status in ('pendiente', 'en_curso', 'finalizada')),
  played_at timestamptz not null default now(),
  unique (matchday_id, home_team_id, away_team_id)
);

create table if not exists public.lineups (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  matchday_id uuid not null references public.matchdays(id) on delete cascade,
  formation text not null check (formation in ('4-4-2', '4-3-3', '3-5-2', '3-4-3', '5-3-2', '4-5-1')),
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'locked')),
  created_at timestamptz not null default now(),
  unique (league_id, user_id, matchday_id)
);

create table if not exists public.lineup_players (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references public.lineups(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  slot integer not null,
  is_starter boolean not null default true,
  position text not null check (position in ('POR', 'DEF', 'MED', 'DEL')),
  unique (lineup_id, player_id)
);

create table if not exists public.player_match_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  minutes integer not null default 0,
  goals integer not null default 0,
  assists integer not null default 0,
  yellow_cards integer not null default 0,
  red_cards integer not null default 0,
  double_yellow_cards integer not null default 0,
  own_goals integer not null default 0,
  penalties_scored integer not null default 0,
  penalties_missed integer not null default 0,
  penalties_saved integer not null default 0,
  penalties_provoked integer not null default 0,
  goals_conceded integer not null default 0,
  clean_sheet boolean not null default false,
  overload_rating integer not null default 0 check (overload_rating between 0 and 4),
  mvp boolean not null default false,
  team_won boolean not null default false,
  team_lost boolean not null default false,
  highlighted boolean not null default false,
  error_led_to_goal boolean not null default false,
  fantasy_points integer not null default 0,
  unique (match_id, player_id)
);

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  type text not null check (type in ('buy', 'sell', 'offer', 'offer_accepted', 'clause_buy', 'clause_raise', 'auction_win', 'league_offer')),
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  from_user_id uuid not null references public.profiles(user_id) on delete cascade,
  to_user_id uuid references public.profiles(user_id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'outbid')),
  created_at timestamptz not null default now()
);

create table if not exists public.scoring_rules (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null unique references public.leagues(id) on delete cascade,
  rules_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_feed (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  type text not null,
  message text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_sync_status (
  id text primary key default 'overload-series',
  source_url text not null default 'https://challenge.place/c/68486e1155cbb0e036a0559f/stage/69de85f89e7d357d88be816c',
  status text not null default 'idle' check (status in ('idle', 'checking', 'ok', 'changed', 'error')),
  message text not null default 'Sincronizacion preparada.',
  snapshot_hash text,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.challenge_sync_status (id)
values ('overload-series')
on conflict (id) do nothing;

create index if not exists idx_league_members_user on public.league_members(user_id);
create index if not exists idx_league_players_league_owner on public.league_players(league_id, owner_user_id);
create index if not exists idx_squads_league_user on public.squads(league_id, user_id);
create index if not exists idx_matches_matchday on public.matches(matchday_id);
create index if not exists idx_player_stats_match on public.player_match_stats(match_id);
create index if not exists idx_activity_league_created on public.activity_feed(league_id, created_at desc);
