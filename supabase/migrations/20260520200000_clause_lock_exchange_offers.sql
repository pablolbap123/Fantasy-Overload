alter table public.league_players
  add column if not exists clause_locked_until timestamptz;

alter table public.offers
  add column if not exists kind text not null default 'transfer';

alter table public.offers
  add column if not exists exchange_player_id uuid references public.players(id) on delete set null;

alter table public.offers
  drop constraint if exists offers_kind_check;

alter table public.offers
  add constraint offers_kind_check check (kind in ('transfer', 'exchange'));

update public.league_players
set release_clause = round((greatest(price, 0) * 1.2) / 50000) * 50000
where price > 0;

update public.league_players lp
set clause_locked_until = s.acquired_at + interval '5 days'
from public.squads s
where lp.league_id = s.league_id
  and lp.player_id = s.player_id
  and lp.owner_user_id = s.user_id
  and lp.owner_user_id is not null
  and lp.clause_locked_until is null;

create or replace function public.default_release_clause(p_price numeric)
returns numeric
language sql
immutable
as $$
  select round((greatest(coalesce(p_price, 0), 0) * 1.2) / 50000) * 50000
$$;

create or replace function public.clause_raise_cost(p_from numeric, p_to numeric)
returns numeric
language sql
immutable
as $$
  select greatest(250000, round(((greatest(coalesce(p_to, 0), 0) - greatest(coalesce(p_from, 0), 0)) * 0.6) / 50000) * 50000)
$$;
