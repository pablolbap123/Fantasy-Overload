alter table public.player_match_stats add column if not exists key_passes integer not null default 0;
alter table public.player_match_stats add column if not exists overload_score numeric;
alter table public.player_match_stats add column if not exists saves integer not null default 0;
alter table public.player_match_stats add column if not exists shots_on_target integer not null default 0;
alter table public.player_match_stats add column if not exists successful_dribbles integer not null default 0;
alter table public.player_match_stats add column if not exists box_entries integer not null default 0;
alter table public.player_match_stats add column if not exists balls_lost integer not null default 0;
alter table public.player_match_stats add column if not exists balls_recovered integer not null default 0;
alter table public.player_match_stats add column if not exists clearances integer not null default 0;

update public.scoring_rules
set rules_json = coalesce(rules_json, '{}'::jsonb)
  || '{
    "playedUnder60": 1,
    "playedOver60": 2,
    "goal": { "POR": 6, "DEF": 6, "MED": 5, "DEL": 4 },
    "assist": 3,
    "keyPass": 1,
    "cleanSheet": { "POR": 4, "DEF": 4, "MED": 2, "DEL": 1 },
    "goalsConcededEveryTwo": { "POR": -2, "DEF": -2, "MED": -1, "DEL": -1 },
    "yellowCard": -1,
    "doubleYellowCard": -1,
    "redCard": -3,
    "ownGoal": -2,
    "penaltyMissed": -2,
    "penaltySaved": 5,
    "penaltyProvoked": 2,
    "savesEveryTwo": 1,
    "overloadRating": { "0": 0, "1": 1, "2": 2, "3": 3, "4": 4 },
    "shotsOnTargetEveryTwo": 1,
    "successfulDribblesEveryTwo": 1,
    "boxEntriesEveryTwo": 1,
    "ballsLostEveryTen": -1,
    "ballsRecoveredEveryFive": 1,
    "clearancesEveryFive": 1
  }'::jsonb;
