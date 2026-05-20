alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.official_matchdays enable row level security;
alter table public.official_matches enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.league_players enable row level security;
alter table public.squads enable row level security;
alter table public.matchdays enable row level security;
alter table public.matches enable row level security;
alter table public.lineups enable row level security;
alter table public.lineup_players enable row level security;
alter table public.player_match_stats enable row level security;
alter table public.transfers enable row level security;
alter table public.offers enable row level security;
alter table public.scoring_rules enable row level security;
alter table public.activity_feed enable row level security;
alter table public.challenge_sync_status enable row level security;

create or replace function public.is_league_member(p_league_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = p_user_id
  );
$$;

create or replace function public.is_league_admin(p_league_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = p_user_id and role = 'admin'
  );
$$;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.league_members mine
    join public.league_members other_member on other_member.league_id = mine.league_id
    where mine.user_id = auth.uid() and other_member.user_id = profiles.user_id
  )
);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists teams_select_auth on public.teams;
create policy teams_select_auth on public.teams for select to authenticated using (true);

drop policy if exists players_select_auth on public.players;
create policy players_select_auth on public.players for select to authenticated using (true);

drop policy if exists official_matchdays_select_auth on public.official_matchdays;
create policy official_matchdays_select_auth on public.official_matchdays for select to authenticated using (true);

drop policy if exists official_matches_select_auth on public.official_matches;
create policy official_matches_select_auth on public.official_matches for select to authenticated using (true);

drop policy if exists leagues_select_member on public.leagues;
create policy leagues_select_member on public.leagues
for select to authenticated
using (public.is_league_member(id));

drop policy if exists leagues_update_admin on public.leagues;
create policy leagues_update_admin on public.leagues
for update to authenticated
using (public.is_league_admin(id))
with check (public.is_league_admin(id));

drop policy if exists league_members_select_member on public.league_members;
create policy league_members_select_member on public.league_members
for select to authenticated
using (public.is_league_member(league_id));

drop policy if exists league_members_delete_own_or_admin on public.league_members;
create policy league_members_delete_own_or_admin on public.league_members
for delete to authenticated
using (user_id = auth.uid() or public.is_league_admin(league_id));

drop policy if exists league_players_select_member on public.league_players;
create policy league_players_select_member on public.league_players
for select to authenticated
using (public.is_league_member(league_id));

drop policy if exists squads_select_member on public.squads;
create policy squads_select_member on public.squads
for select to authenticated
using (public.is_league_member(league_id));

drop policy if exists matchdays_select_member on public.matchdays;
create policy matchdays_select_member on public.matchdays
for select to authenticated
using (public.is_league_member(league_id));

drop policy if exists matchdays_update_admin on public.matchdays;
create policy matchdays_update_admin on public.matchdays
for update to authenticated
using (public.is_league_admin(league_id))
with check (public.is_league_admin(league_id));

drop policy if exists matches_select_member on public.matches;
create policy matches_select_member on public.matches
for select to authenticated
using (
  exists (
    select 1 from public.matchdays md
    where md.id = matches.matchday_id and public.is_league_member(md.league_id)
  )
);

drop policy if exists matches_update_admin on public.matches;
create policy matches_update_admin on public.matches
for update to authenticated
using (
  exists (
    select 1 from public.matchdays md
    where md.id = matches.matchday_id and public.is_league_admin(md.league_id)
  )
)
with check (
  exists (
    select 1 from public.matchdays md
    where md.id = matches.matchday_id and public.is_league_admin(md.league_id)
  )
);

drop policy if exists lineups_select_member on public.lineups;
create policy lineups_select_member on public.lineups
for select to authenticated
using (public.is_league_member(league_id));

drop policy if exists lineups_insert_own on public.lineups;
create policy lineups_insert_own on public.lineups
for insert to authenticated
with check (user_id = auth.uid() and public.is_league_member(league_id));

drop policy if exists lineups_update_own on public.lineups;
create policy lineups_update_own on public.lineups
for update to authenticated
using (user_id = auth.uid() and public.is_league_member(league_id))
with check (user_id = auth.uid() and public.is_league_member(league_id));

drop policy if exists lineup_players_select_member on public.lineup_players;
create policy lineup_players_select_member on public.lineup_players
for select to authenticated
using (
  exists (
    select 1 from public.lineups l
    where l.id = lineup_players.lineup_id and public.is_league_member(l.league_id)
  )
);

drop policy if exists player_match_stats_select_member on public.player_match_stats;
create policy player_match_stats_select_member on public.player_match_stats
for select to authenticated
using (
  exists (
    select 1
    from public.matches m
    join public.matchdays md on md.id = m.matchday_id
    where m.id = player_match_stats.match_id and public.is_league_member(md.league_id)
  )
);

drop policy if exists transfers_select_member on public.transfers;
create policy transfers_select_member on public.transfers
for select to authenticated
using (public.is_league_member(league_id));

drop policy if exists offers_select_member on public.offers;
create policy offers_select_member on public.offers
for select to authenticated
using (public.is_league_member(league_id));

drop policy if exists offers_insert_member on public.offers;
create policy offers_insert_member on public.offers
for insert to authenticated
with check (from_user_id = auth.uid() and public.is_league_member(league_id));

drop policy if exists scoring_rules_select_member on public.scoring_rules;
create policy scoring_rules_select_member on public.scoring_rules
for select to authenticated
using (public.is_league_member(league_id));

drop policy if exists scoring_rules_upsert_admin on public.scoring_rules;
create policy scoring_rules_upsert_admin on public.scoring_rules
for all to authenticated
using (public.is_league_admin(league_id))
with check (public.is_league_admin(league_id));

drop policy if exists activity_feed_select_member on public.activity_feed;
create policy activity_feed_select_member on public.activity_feed
for select to authenticated
using (public.is_league_member(league_id));

drop policy if exists challenge_sync_status_select_auth on public.challenge_sync_status;
create policy challenge_sync_status_select_auth on public.challenge_sync_status
for select to authenticated
using (true);
