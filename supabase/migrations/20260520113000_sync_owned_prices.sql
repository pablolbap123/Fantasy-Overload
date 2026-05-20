create or replace function public.sync_league_from_official(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    perform public.ensure_profile();
    if not public.is_league_admin(p_league_id) then
      raise exception 'not_admin';
    end if;
  end if;

  if not exists (select 1 from public.leagues where id = p_league_id) then
    raise exception 'league_not_found';
  end if;

  insert into public.league_players (league_id, player_id, market_status, price, release_clause)
  select
    p_league_id,
    p.id,
    'locked',
    p.current_price,
    round((p.current_price * 1.8) / 50000) * 50000
  from public.players p
  on conflict (league_id, player_id) do update
  set price = excluded.price,
      release_clause = case
        when public.league_players.owner_user_id is null then excluded.release_clause
        else greatest(public.league_players.release_clause, excluded.release_clause)
      end;

  insert into public.matchdays (league_id, number, status, starts_at, ends_at)
  select p_league_id, number, status, starts_at, ends_at
  from public.official_matchdays
  on conflict (league_id, number) do update
  set status = excluded.status,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at;

  insert into public.matches (matchday_id, home_team_id, away_team_id, home_score, away_score, status, played_at)
  select md.id, ht.id, at.id, om.home_score, om.away_score, om.status, om.played_at
  from public.official_matches om
  join public.matchdays md on md.league_id = p_league_id and md.number = om.matchday_number
  join public.teams ht on ht.short_name = om.home_team_short_name
  join public.teams at on at.short_name = om.away_team_short_name
  on conflict (matchday_id, home_team_id, away_team_id) do update
  set home_score = excluded.home_score,
      away_score = excluded.away_score,
      status = excluded.status,
      played_at = excluded.played_at;

  insert into public.player_match_stats (
    match_id, player_id, minutes, goals, assists, yellow_cards, red_cards, double_yellow_cards, own_goals,
    penalties_scored, penalties_missed, penalties_saved, penalties_provoked, goals_conceded, clean_sheet,
    overload_rating, mvp, team_won, team_lost, highlighted, error_led_to_goal, fantasy_points
  )
  select
    m.id,
    s.player_uuid,
    s.minutes,
    s.goals,
    s.assists,
    s.yellow_cards,
    s.red_cards,
    s.double_yellow_cards,
    s.own_goals,
    s.penalties_scored,
    s.penalties_missed,
    s.penalties_saved,
    s.penalties_provoked,
    s.goals_conceded,
    s.clean_sheet,
    s.overload_rating,
    s.mvp,
    s.team_won,
    s.team_lost,
    s.highlighted,
    s.error_led_to_goal,
    s.fantasy_points
  from public.official_matches om
  join public.matchdays md on md.league_id = p_league_id and md.number = om.matchday_number
  join public.teams ht on ht.short_name = om.home_team_short_name
  join public.teams at on at.short_name = om.away_team_short_name
  join public.matches m on m.matchday_id = md.id and m.home_team_id = ht.id and m.away_team_id = at.id
  cross join lateral jsonb_to_recordset(om.player_stats_json) as s(
    player_uuid uuid,
    minutes integer,
    goals integer,
    assists integer,
    yellow_cards integer,
    red_cards integer,
    double_yellow_cards integer,
    own_goals integer,
    penalties_scored integer,
    penalties_missed integer,
    penalties_saved integer,
    penalties_provoked integer,
    goals_conceded integer,
    clean_sheet boolean,
    overload_rating integer,
    mvp boolean,
    team_won boolean,
    team_lost boolean,
    highlighted boolean,
    error_led_to_goal boolean,
    fantasy_points integer
  )
  on conflict (match_id, player_id) do update
  set minutes = excluded.minutes,
      goals = excluded.goals,
      assists = excluded.assists,
      yellow_cards = excluded.yellow_cards,
      red_cards = excluded.red_cards,
      double_yellow_cards = excluded.double_yellow_cards,
      own_goals = excluded.own_goals,
      penalties_scored = excluded.penalties_scored,
      penalties_missed = excluded.penalties_missed,
      penalties_saved = excluded.penalties_saved,
      penalties_provoked = excluded.penalties_provoked,
      goals_conceded = excluded.goals_conceded,
      clean_sheet = excluded.clean_sheet,
      overload_rating = excluded.overload_rating,
      mvp = excluded.mvp,
      team_won = excluded.team_won,
      team_lost = excluded.team_lost,
      highlighted = excluded.highlighted,
      error_led_to_goal = excluded.error_led_to_goal,
      fantasy_points = excluded.fantasy_points;

  update public.leagues
  set current_matchday = coalesce((select max(number) from public.official_matchdays), current_matchday)
  where id = p_league_id;

  perform public.recalculate_league_points(p_league_id, null);
end;
$$;
