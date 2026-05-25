alter table if exists public.player_match_stats
  add column if not exists manual_override boolean not null default false,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

