alter table public.player_match_stats
  add column if not exists double_yellow_cards integer not null default 0,
  add column if not exists penalties_provoked integer not null default 0,
  add column if not exists overload_rating integer not null default 0;

alter table public.player_match_stats
  drop constraint if exists player_match_stats_overload_rating_check;

alter table public.player_match_stats
  add constraint player_match_stats_overload_rating_check check (overload_rating between 0 and 4);

update public.scoring_rules
set rules_json = public.default_scoring_rules();
