create or replace function public.default_scoring_rules()
returns jsonb
language sql
immutable
as $$
  select '{
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
    "ballsLostEach": -1,
    "ballsRecoveredEach": 1,
    "clearancesEach": 1,
    "ballsLostEveryTen": -1,
    "ballsRecoveredEveryFive": 1,
    "clearancesEveryFive": 1
  }'::jsonb;
$$;

create or replace function public.default_release_clause(p_price numeric)
returns numeric
language sql
immutable
as $$
  select round((greatest(coalesce(p_price, 0), 0) * 1.2) / 50000) * 50000;
$$;

create or replace function public.default_joined_matchday(p_league_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select max(number) + 1 from public.official_matchdays),
    (select current_matchday from public.leagues where id = p_league_id),
    1
  );
$$;

create or replace function public.clause_raise_cost(p_from numeric, p_to numeric)
returns numeric
language sql
immutable
as $$
  select greatest(250000, round(((greatest(coalesce(p_to, 0), 0) - greatest(coalesce(p_from, 0), 0)) * 0.6) / 50000) * 50000);
$$;

create or replace function public.recalculate_player_market_values()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with point_rows as (
    select
      p.id,
      p.base_price,
      entry.key::integer as number,
      entry.value::numeric as points
    from public.players p
    cross join lateral jsonb_each_text(coalesce(p.points_by_matchday, '{}'::jsonb)) as entry(key, value)
    where entry.key ~ '^[0-9]+$'
  ),
  cumulative as (
    select
      id,
      number,
      points,
      round((greatest(500000, least(250000000, base_price + sum(points) over (partition by id order by number) * 250000 + points * 150000))) / 50000) * 50000 as market_value
    from point_rows
  ),
  histories as (
    select id, jsonb_object_agg(number::text, market_value order by number) as price_history
    from cumulative
    group by id
  ),
  latest as (
    select distinct on (id) id, market_value
    from cumulative
    order by id, number desc
  )
  update public.players p
  set
    current_price = coalesce(latest.market_value, p.base_price),
    stats_json = coalesce(p.stats_json, '{}'::jsonb) || jsonb_build_object('priceHistory', coalesce(histories.price_history, '{}'::jsonb))
  from histories
  left join latest on latest.id = histories.id
  where p.id = histories.id;

  update public.players p
  set
    current_price = p.base_price,
    stats_json = coalesce(p.stats_json, '{}'::jsonb) || jsonb_build_object('priceHistory', '{}'::jsonb)
  where not exists (
    select 1
    from jsonb_each_text(coalesce(p.points_by_matchday, '{}'::jsonb))
  );

  update public.league_players lp
  set
    price = p.current_price,
    release_clause = greatest(coalesce(lp.release_clause, 0), public.default_release_clause(p.current_price))
  from public.players p
  where p.id = lp.player_id;
end;
$$;

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.leagues where invite_code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.ensure_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.profiles (user_id, username)
  values (auth.uid(), coalesce(nullif(auth.jwt() -> 'user_metadata' ->> 'username', ''), split_part(auth.jwt() ->> 'email', '@', 1), 'Manager'))
  on conflict (user_id) do nothing;
end;
$$;

create or replace function public.assign_initial_squad(p_league_id uuid, p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing integer;
  v_assigned integer;
  v_initial_budget numeric;
  v_target_value numeric;
  v_total_value numeric;
begin
  if not exists (select 1 from public.league_members where league_id = p_league_id and user_id = p_user_id) then
    raise exception 'not_member';
  end if;

  select count(*) into v_existing
  from public.league_players
  where league_id = p_league_id and owner_user_id = p_user_id;

  if v_existing > 0 then
    return v_existing;
  end if;

  select initial_budget into v_initial_budget
  from public.leagues
  where id = p_league_id;

  select avg(squad_value) into v_target_value
  from (
    select owner_user_id, sum(price) as squad_value
    from public.league_players
    where league_id = p_league_id and owner_user_id is not null
    group by owner_user_id
  ) squads;

  with wanted(position, pick_count) as (
    values ('POR', 2), ('DEF', 5), ('MED', 5), ('DEL', 3)
  ),
  ranked as (
    select
      lp.id as league_player_id,
      p.id as player_id,
      p.position,
      p.current_price,
      row_number() over (
        partition by p.position
        order by p.total_points desc, p.current_price desc, p.id
      ) as position_rank
    from public.league_players lp
    join public.players p on p.id = lp.player_id
    where lp.league_id = p_league_id
      and lp.owner_user_id is null
      and lp.market_status = 'locked'
  ),
  candidates as (
    select r.*, w.pick_count
    from ranked r
    join wanted w on w.position = r.position
    join public.leagues l on l.id = p_league_id
    where r.position_rank <= greatest(w.pick_count * greatest(l.max_members, 8) * 4, w.pick_count * 14)
  ),
  selected as (
    select *
    from (
      select
        c.*,
        row_number() over (
          partition by c.position
          order by md5(p_league_id::text || p_user_id::text || c.player_id::text), c.position_rank
        ) as pick_order
      from candidates c
    ) picks
    where pick_order <= pick_count
  ),
  updated as (
    update public.league_players lp
    set owner_user_id = p_user_id,
        market_status = 'owned',
        price = selected.current_price,
        release_clause = public.default_release_clause(selected.current_price),
        clause_locked_until = now() + interval '5 days',
        market_listed_at = null,
        market_expires_at = null
    from selected
    where lp.id = selected.league_player_id
    returning lp.player_id, lp.price
  ),
  inserted as (
    insert into public.squads (league_id, user_id, player_id, acquired_price)
    select p_league_id, p_user_id, player_id, price
    from updated
    on conflict (league_id, user_id, player_id) do update
    set acquired_price = excluded.acquired_price,
        acquired_at = now()
    returning acquired_price
  )
  select count(*)::integer, coalesce(sum(acquired_price), 0)
  into v_assigned, v_total_value
  from inserted;

  if v_assigned < 15 then
    raise exception 'not_enough_players_for_initial_squad';
  end if;

  update public.league_members
  set budget = greatest(0, v_initial_budget + coalesce(v_target_value, v_total_value) - v_total_value)
  where league_id = p_league_id and user_id = p_user_id;

  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (
    p_league_id,
    'initial_squad',
    'Plantilla inicial asignada.',
    jsonb_build_object('user_id', p_user_id, 'players', v_assigned, 'squad_value', v_total_value)
  );

  return v_assigned;
end;
$$;

create or replace function public.create_league(
  p_name text,
  p_initial_budget numeric,
  p_max_members integer,
  p_rules jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league_id uuid;
  v_matchday_id uuid;
  v_teams uuid[];
  v_team_count integer;
  v_md integer;
  v_i integer;
  v_home uuid;
  v_away uuid;
begin
  perform public.ensure_profile();

  if p_initial_budget < 0 then
    raise exception 'initial_budget_invalid';
  end if;
  if p_max_members < 2 then
    raise exception 'max_members_invalid';
  end if;

  insert into public.leagues (name, invite_code, owner_id, initial_budget, max_members, current_matchday)
  values (p_name, public.generate_invite_code(), auth.uid(), p_initial_budget, least(p_max_members, 50), coalesce((select max(number) + 1 from public.official_matchdays), 8))
  returning id into v_league_id;

  insert into public.league_members (league_id, user_id, role, budget, joined_matchday)
  values (v_league_id, auth.uid(), 'admin', p_initial_budget, public.default_joined_matchday(v_league_id));

  insert into public.scoring_rules (league_id, rules_json)
  values (v_league_id, coalesce(p_rules, public.default_scoring_rules()));

  insert into public.league_players (league_id, player_id, market_status, price, release_clause, market_listed_at, market_expires_at)
  select
    v_league_id,
    id,
    'locked',
    current_price,
    public.default_release_clause(current_price),
    null,
    null
  from public.players;

  perform public.assign_initial_squad(v_league_id, auth.uid());
  perform public.resolve_market_auctions(v_league_id);

  insert into public.matchdays (league_id, number, status, starts_at, ends_at)
  select v_league_id, number, status, starts_at, ends_at
  from public.official_matchdays
  on conflict (league_id, number) do nothing;

  insert into public.matches (matchday_id, home_team_id, away_team_id, home_score, away_score, status, played_at)
  select md.id, ht.id, at.id, om.home_score, om.away_score, om.status, om.played_at
  from public.official_matches om
  join public.matchdays md on md.league_id = v_league_id and md.number = om.matchday_number
  join public.teams ht on ht.short_name = om.home_team_short_name
  join public.teams at on at.short_name = om.away_team_short_name;

  insert into public.player_match_stats (
    match_id, player_id, minutes, goals, assists, key_passes, yellow_cards, red_cards, double_yellow_cards, own_goals,
    penalties_scored, penalties_missed, penalties_saved, penalties_provoked, goals_conceded, clean_sheet,
    overload_score, overload_rating, mvp, team_won, team_lost, highlighted, error_led_to_goal,
    saves, shots_on_target, successful_dribbles, box_entries, balls_lost, balls_recovered, clearances, fantasy_points
  )
  select
    m.id,
    s.player_uuid,
    s.minutes,
    s.goals,
    s.assists,
    coalesce(s.key_passes, 0),
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
    s.overload_score,
    s.overload_rating,
    s.mvp,
    s.team_won,
    s.team_lost,
    s.highlighted,
    s.error_led_to_goal,
    coalesce(s.saves, 0),
    coalesce(s.shots_on_target, 0),
    coalesce(s.successful_dribbles, 0),
    coalesce(s.box_entries, 0),
    coalesce(s.balls_lost, 0),
    coalesce(s.balls_recovered, 0),
    coalesce(s.clearances, 0),
    s.fantasy_points
  from public.official_matches om
  join public.matchdays md on md.league_id = v_league_id and md.number = om.matchday_number
  join public.teams ht on ht.short_name = om.home_team_short_name
  join public.teams at on at.short_name = om.away_team_short_name
  join public.matches m on m.matchday_id = md.id and m.home_team_id = ht.id and m.away_team_id = at.id
  cross join lateral jsonb_to_recordset(om.player_stats_json) as s(
    player_uuid uuid,
    minutes integer,
    goals integer,
    assists integer,
    key_passes integer,
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
    overload_score numeric,
    overload_rating integer,
    mvp boolean,
    team_won boolean,
    team_lost boolean,
    highlighted boolean,
    error_led_to_goal boolean,
    saves integer,
    shots_on_target integer,
    successful_dribbles integer,
    box_entries integer,
    balls_lost integer,
    balls_recovered integer,
    clearances integer,
    fantasy_points integer
  );

  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (v_league_id, 'league_created', 'Liga creada. Comparte el código de invitación para empezar.', jsonb_build_object('owner_id', auth.uid()));

  return v_league_id;
end;
$$;

create or replace function public.join_league_by_code(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league public.leagues%rowtype;
  v_count integer;
begin
  perform public.ensure_profile();

  select * into v_league
  from public.leagues
  where invite_code = upper(trim(p_invite_code))
  for update;

  if not found then
    raise exception 'league_not_found';
  end if;

  if exists (select 1 from public.league_members where league_id = v_league.id and user_id = auth.uid()) then
    raise exception 'already_member';
  end if;

  select count(*) into v_count from public.league_members where league_id = v_league.id;
  if v_count >= v_league.max_members then
    raise exception 'league_full';
  end if;

  insert into public.league_members (league_id, user_id, role, budget, joined_matchday)
  values (v_league.id, auth.uid(), 'member', v_league.initial_budget, public.default_joined_matchday(v_league.id));

  perform public.assign_initial_squad(v_league.id, auth.uid());
  perform public.resolve_market_auctions(v_league.id);

  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (v_league.id, 'member_joined', 'Un nuevo manager se ha unido a la liga.', jsonb_build_object('user_id', auth.uid()));

  return v_league.id;
end;
$$;

create or replace function public.delete_league(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  perform public.ensure_profile();

  select owner_id into v_owner
  from public.leagues
  where id = p_league_id
  for update;

  if not found then
    raise exception 'league_not_found';
  end if;

  if v_owner <> auth.uid() then
    raise exception 'owner_required';
  end if;

  delete from public.leagues
  where id = p_league_id and owner_id = auth.uid();
end;
$$;

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
    public.default_release_clause(p.current_price)
  from public.players p
  on conflict (league_id, player_id) do update
  set price = excluded.price,
      release_clause = case
        when public.league_players.owner_user_id is null then excluded.release_clause
        else greatest(public.league_players.release_clause, public.default_release_clause(excluded.price))
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

  delete from public.player_match_stats pms
  using public.matches m
  join public.matchdays md on md.id = m.matchday_id
  where pms.match_id = m.id
    and md.league_id = p_league_id
    and not coalesce(pms.manual_override, false);

  insert into public.player_match_stats (
    match_id, player_id, minutes, goals, assists, key_passes, yellow_cards, red_cards, double_yellow_cards, own_goals,
    penalties_scored, penalties_missed, penalties_saved, penalties_provoked, goals_conceded, clean_sheet,
    overload_score, overload_rating, mvp, team_won, team_lost, highlighted, error_led_to_goal,
    saves, shots_on_target, successful_dribbles, box_entries, balls_lost, balls_recovered, clearances, fantasy_points
  )
  select
    m.id,
    s.player_uuid,
    s.minutes,
    s.goals,
    s.assists,
    coalesce(s.key_passes, 0),
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
    s.overload_score,
    s.overload_rating,
    s.mvp,
    s.team_won,
    s.team_lost,
    s.highlighted,
    s.error_led_to_goal,
    coalesce(s.saves, 0),
    coalesce(s.shots_on_target, 0),
    coalesce(s.successful_dribbles, 0),
    coalesce(s.box_entries, 0),
    coalesce(s.balls_lost, 0),
    coalesce(s.balls_recovered, 0),
    coalesce(s.clearances, 0),
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
    key_passes integer,
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
    overload_score numeric,
    overload_rating integer,
    mvp boolean,
    team_won boolean,
    team_lost boolean,
    highlighted boolean,
    error_led_to_goal boolean,
    saves integer,
    shots_on_target integer,
    successful_dribbles integer,
    box_entries integer,
    balls_lost integer,
    balls_recovered integer,
    clearances integer,
    fantasy_points integer
  )
  on conflict (match_id, player_id) do update
  set minutes = excluded.minutes,
      goals = excluded.goals,
      assists = excluded.assists,
      key_passes = excluded.key_passes,
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
      overload_score = excluded.overload_score,
      overload_rating = excluded.overload_rating,
      mvp = excluded.mvp,
      team_won = excluded.team_won,
      team_lost = excluded.team_lost,
      highlighted = excluded.highlighted,
      error_led_to_goal = excluded.error_led_to_goal,
      saves = excluded.saves,
      shots_on_target = excluded.shots_on_target,
      successful_dribbles = excluded.successful_dribbles,
      box_entries = excluded.box_entries,
      balls_lost = excluded.balls_lost,
      balls_recovered = excluded.balls_recovered,
      clearances = excluded.clearances,
      fantasy_points = excluded.fantasy_points,
      updated_at = now()
  where not coalesce(public.player_match_stats.manual_override, false);

  update public.leagues
  set current_matchday = coalesce((select max(number) + 1 from public.official_matchdays), current_matchday)
  where id = p_league_id;

  perform public.recalculate_league_points(p_league_id, null);
  perform public.recalculate_player_totals_from_league(p_league_id);
end;
$$;

create or replace function public.sync_all_leagues_from_official()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  for v_league_id in select id from public.leagues loop
    perform public.sync_league_from_official(v_league_id);
  end loop;

  update public.leagues
  set current_matchday = coalesce((select max(number) + 1 from public.official_matchdays), current_matchday);

  perform public.recalculate_player_market_values();
end;
$$;

create or replace function public.buy_player(p_league_id uuid, p_player_id uuid, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.league_members%rowtype;
  v_league public.leagues%rowtype;
  v_lp public.league_players%rowtype;
  v_player_name text;
  v_previous_owner uuid;
  v_transfer_type text;
begin
  perform public.ensure_profile();

  select * into v_league from public.leagues where id = p_league_id for update;
  if not found then raise exception 'league_not_found'; end if;
  if v_league.market_locked then raise exception 'market_locked'; end if;

  select * into v_member
  from public.league_members
  where league_id = p_league_id and user_id = auth.uid()
  for update;
  if not found then raise exception 'not_member'; end if;

  select * into v_lp
  from public.league_players
  where league_id = p_league_id and player_id = p_player_id
  for update;
  if not found then raise exception 'player_not_in_market'; end if;
  if v_lp.owner_user_id = auth.uid() then raise exception 'already_owner'; end if;
  if v_lp.owner_user_id is null and v_lp.market_status <> 'market' then raise exception 'player_not_in_market'; end if;
  if v_lp.owner_user_id is null and p_amount < v_lp.price then raise exception 'amount_below_price'; end if;
  if v_lp.owner_user_id is not null and v_lp.clause_locked_until is not null and v_lp.clause_locked_until > now() then
    raise exception 'clause_locked_until_%', v_lp.clause_locked_until;
  end if;
  if v_lp.owner_user_id is not null and p_amount < v_lp.release_clause then raise exception 'amount_below_clause'; end if;
  if v_member.budget < p_amount then raise exception 'not_enough_budget'; end if;
  v_previous_owner := v_lp.owner_user_id;
  v_transfer_type := case when v_previous_owner is null then 'buy' else 'clause_buy' end;

  update public.league_members
  set budget = budget - p_amount
  where id = v_member.id;

  if v_previous_owner is not null then
    update public.league_members
    set budget = budget + p_amount
    where league_id = p_league_id and user_id = v_previous_owner;

    delete from public.squads
    where league_id = p_league_id and user_id = v_previous_owner and player_id = p_player_id;

    delete from public.lineup_players lp
    using public.lineups l
    where l.id = lp.lineup_id
      and l.league_id = p_league_id
      and l.user_id = v_previous_owner
      and l.status = 'draft'
      and lp.player_id = p_player_id;
  end if;

  update public.league_players
  set owner_user_id = auth.uid(),
      listed_by_user_id = null,
      market_status = 'owned',
      price = p_amount,
      release_clause = public.default_release_clause(p_amount),
      clause_locked_until = now() + interval '5 days'
  where id = v_lp.id;

  insert into public.squads (league_id, user_id, player_id, acquired_price)
  values (p_league_id, auth.uid(), p_player_id, p_amount)
  on conflict (league_id, user_id, player_id) do update set acquired_price = excluded.acquired_price, acquired_at = now();

  insert into public.transfers (league_id, user_id, player_id, type, amount)
  values (p_league_id, auth.uid(), p_player_id, v_transfer_type, p_amount);

  select name into v_player_name from public.players where id = p_player_id;
  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (
    p_league_id,
    'transfer',
    case when v_previous_owner is null
      then 'Fichaje completado: ' || coalesce(v_player_name, 'jugador')
      else 'Cláusula pagada: ' || coalesce(v_player_name, 'jugador')
    end,
    jsonb_build_object('user_id', auth.uid(), 'previous_owner', v_previous_owner, 'player_id', p_player_id, 'amount', p_amount)
  );
end;
$$;

create or replace function public.sell_player(p_league_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lp public.league_players%rowtype;
  v_amount numeric;
  v_player_name text;
begin
  perform public.ensure_profile();

  if exists (select 1 from public.leagues where id = p_league_id and market_locked) then
    raise exception 'market_locked';
  end if;

  select * into v_lp
  from public.league_players
  where league_id = p_league_id and player_id = p_player_id
  for update;

  if not found or v_lp.owner_user_id <> auth.uid() then
    raise exception 'not_player_owner';
  end if;

  v_amount := round((v_lp.price * 0.5) / 50000) * 50000;

  update public.league_members
  set budget = budget + v_amount
  where league_id = p_league_id and user_id = auth.uid();

  update public.league_players
  set owner_user_id = null,
      listed_by_user_id = null,
      market_status = 'locked',
      price = v_amount,
      release_clause = public.default_release_clause(v_amount),
      clause_locked_until = null,
      market_listed_at = null,
      market_expires_at = null
  where id = v_lp.id;

  delete from public.squads
  where league_id = p_league_id and user_id = auth.uid() and player_id = p_player_id;

  delete from public.lineup_players lp
  using public.lineups l
  where l.id = lp.lineup_id
    and l.league_id = p_league_id
    and l.user_id = auth.uid()
    and l.status = 'draft'
    and lp.player_id = p_player_id;

  insert into public.transfers (league_id, user_id, player_id, type, amount)
  values (p_league_id, auth.uid(), p_player_id, 'sell', v_amount);

  select name into v_player_name from public.players where id = p_player_id;
  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (p_league_id, 'transfer', 'Venta rapida completada: ' || coalesce(v_player_name, 'jugador'), jsonb_build_object('user_id', auth.uid(), 'player_id', p_player_id, 'amount', v_amount));
end;
$$;

create or replace function public.list_player_on_market(p_league_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lp public.league_players%rowtype;
  v_player_name text;
begin
  perform public.ensure_profile();

  if exists (select 1 from public.leagues where id = p_league_id and market_locked) then
    raise exception 'market_locked';
  end if;

  select * into v_lp
  from public.league_players
  where league_id = p_league_id and player_id = p_player_id
  for update;

  if not found or v_lp.owner_user_id <> auth.uid() then
    raise exception 'not_player_owner';
  end if;

  if exists (
    select 1
    from public.players p
    join public.teams t on t.id = p.team_id
    where p.id = p_player_id
      and (upper(t.short_name) = 'BLSA' or lower(t.name) like '%bolsa%')
  ) then
    raise exception 'bag_player_not_marketable';
  end if;

  update public.league_players
  set owner_user_id = null,
      listed_by_user_id = auth.uid(),
      market_status = 'market',
      market_listed_at = now(),
      market_expires_at = now() + interval '5 hours'
  where id = v_lp.id;

  delete from public.squads
  where league_id = p_league_id and user_id = auth.uid() and player_id = p_player_id;

  delete from public.lineup_players lp
  using public.lineups l
  where l.id = lp.lineup_id
    and l.league_id = p_league_id
    and l.user_id = auth.uid()
    and l.status = 'draft'
    and lp.player_id = p_player_id;

  select name into v_player_name from public.players where id = p_player_id;
  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (
    p_league_id,
    'market_listing',
    'Jugador puesto en mercado: ' || coalesce(v_player_name, 'jugador'),
    jsonb_build_object('user_id', auth.uid(), 'player_id', p_player_id, 'expires_at', now() + interval '5 hours', 'duration_hours', 5)
  );
end;
$$;

alter table if exists public.player_match_stats
  add column if not exists scoring_position text,
  add column if not exists manual_override boolean not null default false,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_match_stats_scoring_position_check'
      and conrelid = 'public.player_match_stats'::regclass
  ) then
    alter table public.player_match_stats
      add constraint player_match_stats_scoring_position_check
      check (scoring_position is null or scoring_position in ('POR', 'DEF', 'MED', 'DEL'));
  end if;
end $$;

create or replace function public.cancel_market_listing(p_league_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lp public.league_players%rowtype;
  v_player_name text;
begin
  perform public.ensure_profile();

  select * into v_lp
  from public.league_players
  where league_id = p_league_id and player_id = p_player_id
  for update;

  if not found or v_lp.listed_by_user_id <> auth.uid() then
    raise exception 'not_listing_owner';
  end if;

  update public.league_players
  set owner_user_id = auth.uid(),
      listed_by_user_id = null,
      market_status = 'owned',
      market_listed_at = null,
      market_expires_at = null
  where id = v_lp.id;

  insert into public.squads (league_id, user_id, player_id, acquired_price)
  values (p_league_id, auth.uid(), p_player_id, v_lp.price)
  on conflict (league_id, user_id, player_id) do update
  set acquired_price = excluded.acquired_price,
      acquired_at = now();

  update public.offers
  set status = 'rejected'
  where league_id = p_league_id and player_id = p_player_id and status = 'pending';

  select name into v_player_name from public.players where id = p_player_id;
  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (
    p_league_id,
    'market_listing_cancelled',
    'Jugador retirado del mercado: ' || coalesce(v_player_name, 'jugador'),
    jsonb_build_object('user_id', auth.uid(), 'player_id', p_player_id)
  );
end;
$$;

create or replace function public.raise_player_clause(p_league_id uuid, p_player_id uuid, p_spend_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lp public.league_players%rowtype;
  v_member public.league_members%rowtype;
  v_player_name text;
  v_cost numeric;
  v_new_clause numeric;
begin
  perform public.ensure_profile();

  if exists (select 1 from public.leagues where id = p_league_id and market_locked) then
    raise exception 'market_locked';
  end if;

  select * into v_lp
  from public.league_players
  where league_id = p_league_id and player_id = p_player_id
  for update;

  if not found or v_lp.owner_user_id <> auth.uid() then
    raise exception 'not_player_owner';
  end if;

  v_cost := round(greatest(coalesce(p_spend_amount, 0), 0) / 50000) * 50000;
  if v_cost <= 0 then
    raise exception 'invalid_clause_spend';
  end if;

  v_new_clause := v_lp.release_clause + (v_cost * 3);

  select * into v_member
  from public.league_members
  where league_id = p_league_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'not_member';
  end if;

  if v_member.budget < v_cost then
    raise exception 'not_enough_budget';
  end if;

  update public.league_members
  set budget = budget - v_cost
  where id = v_member.id;

  update public.league_players
  set release_clause = v_new_clause
  where id = v_lp.id;

  insert into public.transfers (league_id, user_id, player_id, type, amount)
  values (p_league_id, auth.uid(), p_player_id, 'clause_raise', v_cost);

  select name into v_player_name from public.players where id = p_player_id;
  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (
    p_league_id,
    'clause',
    'Cláusula actualizada: ' || coalesce(v_player_name, 'jugador'),
    jsonb_build_object('user_id', auth.uid(), 'player_id', p_player_id, 'new_clause', v_new_clause, 'cost', v_cost, 'increase', v_cost * 3)
  );
end;
$$;

create or replace function public.place_market_bid(p_league_id uuid, p_player_id uuid, p_amount numeric)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lp public.league_players%rowtype;
  v_member public.league_members%rowtype;
  v_highest numeric;
  v_minimum numeric;
  v_player_name text;
  v_offer_id uuid;
begin
  perform public.ensure_profile();

  if exists (select 1 from public.leagues where id = p_league_id and market_locked) then
    raise exception 'market_locked';
  end if;

  select * into v_lp
  from public.league_players
  where league_id = p_league_id and player_id = p_player_id
  for update;

  if not found or v_lp.owner_user_id is not null or v_lp.market_status <> 'market' then
    raise exception 'player_not_in_daily_market';
  end if;

  if exists (
    select 1
    from public.players p
    join public.teams t on t.id = p.team_id
    where p.id = p_player_id
      and (upper(t.short_name) = 'BLSA' or lower(t.name) like '%bolsa%')
  ) then
    raise exception 'bag_player_not_marketable';
  end if;

  if v_lp.listed_by_user_id = auth.uid() then
    raise exception 'cannot_bid_own_listing';
  end if;

  if v_lp.market_expires_at is null or v_lp.market_expires_at <= now() then
    raise exception 'auction_finished';
  end if;

  select * into v_member
  from public.league_members
  where league_id = p_league_id and user_id = auth.uid()
  for update;

  if not found then raise exception 'not_member'; end if;
  if v_member.budget < p_amount then raise exception 'not_enough_budget'; end if;

  select max(amount) into v_highest
  from public.offers
  where league_id = p_league_id and player_id = p_player_id and status = 'pending';

  v_minimum := greatest(v_lp.price, coalesce(v_highest, 0));
  if p_amount < v_minimum then
    raise exception 'bid_too_low';
  end if;

  update public.offers
  set status = 'outbid'
  where league_id = p_league_id
    and player_id = p_player_id
    and from_user_id = auth.uid()
    and status = 'pending';

  insert into public.offers (league_id, from_user_id, to_user_id, player_id, amount, status)
  values (p_league_id, auth.uid(), v_lp.listed_by_user_id, p_player_id, p_amount, 'pending')
  returning id into v_offer_id;

  select name into v_player_name from public.players where id = p_player_id;
  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (
    p_league_id,
    'bid',
    'Nueva puja por ' || coalesce(v_player_name, 'jugador'),
    jsonb_build_object('user_id', auth.uid(), 'player_id', p_player_id, 'amount', p_amount)
  );

  return v_offer_id;
end;
$$;

create or replace function public.resolve_market_auctions(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lp public.league_players%rowtype;
  v_offer public.offers%rowtype;
  v_player_name text;
  v_active_count integer;
  v_league_offer numeric;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    perform public.ensure_profile();
    if not public.is_league_member(p_league_id) then
      raise exception 'not_member';
    end if;
  end if;

  insert into public.squads (league_id, user_id, player_id, acquired_price)
  select lp.league_id, lp.listed_by_user_id, lp.player_id, lp.price
  from public.league_players lp
  join public.players p on p.id = lp.player_id
  join public.teams t on t.id = p.team_id
  where lp.league_id = p_league_id
    and lp.listed_by_user_id is not null
    and lp.market_status = 'market'
    and (upper(t.short_name) = 'BLSA' or lower(t.name) like '%bolsa%')
  on conflict (league_id, user_id, player_id) do update
  set acquired_price = excluded.acquired_price,
      acquired_at = now();

  update public.league_players lp
  set owner_user_id = lp.listed_by_user_id,
      listed_by_user_id = null,
      market_status = 'owned',
      market_listed_at = null,
      market_expires_at = null
  from public.players p
  join public.teams t on t.id = p.team_id
  where p.id = lp.player_id
    and lp.league_id = p_league_id
    and lp.listed_by_user_id is not null
    and lp.market_status = 'market'
    and (upper(t.short_name) = 'BLSA' or lower(t.name) like '%bolsa%');

  update public.league_players lp
  set market_status = 'locked',
      market_listed_at = null,
      market_expires_at = null
  from public.players p
  join public.teams t on t.id = p.team_id
  where p.id = lp.player_id
    and lp.league_id = p_league_id
    and lp.owner_user_id is null
    and lp.listed_by_user_id is null
    and lp.market_status = 'market'
    and (upper(t.short_name) = 'BLSA' or lower(t.name) like '%bolsa%');

  for v_lp in
    select *
    from public.league_players
    where league_id = p_league_id
      and owner_user_id is null
      and market_status = 'market'
      and market_expires_at is not null
      and market_expires_at <= now()
    for update
  loop
    select o.* into v_offer
    from public.offers o
    join public.league_members lm on lm.league_id = o.league_id and lm.user_id = o.from_user_id
    where o.league_id = p_league_id
      and o.player_id = v_lp.player_id
      and o.status = 'pending'
      and lm.budget >= o.amount
    order by o.amount desc, o.created_at asc
    limit 1;

    if found then
      update public.league_members
      set budget = budget - v_offer.amount
      where league_id = p_league_id and user_id = v_offer.from_user_id;

      if v_lp.listed_by_user_id is not null then
        update public.league_members
        set budget = budget + v_offer.amount
        where league_id = p_league_id and user_id = v_lp.listed_by_user_id;
      end if;

      update public.league_players
      set owner_user_id = v_offer.from_user_id,
          listed_by_user_id = null,
          market_status = 'owned',
          price = v_offer.amount,
          release_clause = public.default_release_clause(v_offer.amount),
          clause_locked_until = now() + interval '5 days',
          market_listed_at = null,
          market_expires_at = null
      where id = v_lp.id;

      insert into public.squads (league_id, user_id, player_id, acquired_price)
      values (p_league_id, v_offer.from_user_id, v_lp.player_id, v_offer.amount)
      on conflict (league_id, user_id, player_id) do update
      set acquired_price = excluded.acquired_price, acquired_at = now();

      update public.offers
      set status = case when id = v_offer.id then 'accepted' else 'outbid' end
      where league_id = p_league_id and player_id = v_lp.player_id and status = 'pending';

      insert into public.transfers (league_id, user_id, player_id, type, amount)
      values (p_league_id, v_offer.from_user_id, v_lp.player_id, 'auction_win', v_offer.amount);

      select name into v_player_name from public.players where id = v_lp.player_id;
      insert into public.activity_feed (league_id, type, message, metadata_json)
      values (
        p_league_id,
        'auction',
        'Subasta adjudicada: ' || coalesce(v_player_name, 'jugador'),
        jsonb_build_object('user_id', v_offer.from_user_id, 'seller_id', v_lp.listed_by_user_id, 'player_id', v_lp.player_id, 'amount', v_offer.amount)
      );
    else
      update public.offers
      set status = 'rejected'
      where league_id = p_league_id and player_id = v_lp.player_id and status = 'pending';

      if v_lp.listed_by_user_id is not null then
        v_league_offer := round((v_lp.price * (0.5 + random() * 0.35)) / 50000) * 50000;

        update public.league_members
        set budget = budget + v_league_offer
        where league_id = p_league_id and user_id = v_lp.listed_by_user_id;

        update public.league_players
        set listed_by_user_id = null,
            market_status = 'locked',
            price = v_league_offer,
            release_clause = public.default_release_clause(v_league_offer),
            clause_locked_until = null,
            market_listed_at = null,
            market_expires_at = null
        where id = v_lp.id;

        insert into public.transfers (league_id, user_id, player_id, type, amount)
        values (p_league_id, v_lp.listed_by_user_id, v_lp.player_id, 'league_offer', v_league_offer);

        select name into v_player_name from public.players where id = v_lp.player_id;
        insert into public.activity_feed (league_id, type, message, metadata_json)
        values (
          p_league_id,
          'league_offer',
          'La liga ofrece por ' || coalesce(v_player_name, 'jugador'),
          jsonb_build_object('user_id', v_lp.listed_by_user_id, 'player_id', v_lp.player_id, 'amount', v_league_offer)
        );
      else
        update public.league_players
        set listed_by_user_id = null,
            market_status = 'locked',
            market_listed_at = null,
            market_expires_at = null
        where id = v_lp.id;
      end if;
    end if;
  end loop;

  with ranked_active as (
    select
      lp.id,
      (upper(t.short_name) = 'BLSA' or lower(t.name) like '%bolsa%') as is_bag_player,
      row_number() over (
        partition by case when upper(t.short_name) = 'BLSA' or lower(t.name) like '%bolsa%' then 1 else 0 end
        order by lp.market_listed_at asc nulls last, lp.id
      ) as position
    from public.league_players lp
    join public.players p on p.id = lp.player_id
    join public.teams t on t.id = p.team_id
    where lp.league_id = p_league_id
      and lp.owner_user_id is null
      and lp.listed_by_user_id is null
      and lp.market_status = 'market'
      and lp.market_expires_at > now()
  )
  update public.league_players lp
  set market_status = 'locked',
      market_listed_at = null,
      market_expires_at = null
  from ranked_active ranked
  where lp.id = ranked.id
    and (ranked.is_bag_player or ranked.position > 15);

  update public.league_players lp
  set market_expires_at = least(lp.market_expires_at, now() + interval '5 hours')
  from public.players p
  join public.teams t on t.id = p.team_id
  where p.id = lp.player_id
    and lp.league_id = p_league_id
    and lp.owner_user_id is null
    and lp.market_status = 'market'
    and lp.market_expires_at > now()
    and upper(t.short_name) <> 'BLSA'
    and lower(t.name) not like '%bolsa%';

  select count(*) into v_active_count
  from public.league_players lp
  join public.players p on p.id = lp.player_id
  join public.teams t on t.id = p.team_id
  where lp.league_id = p_league_id
    and lp.owner_user_id is null
    and lp.listed_by_user_id is null
    and lp.market_status = 'market'
    and lp.market_expires_at > now()
    and upper(t.short_name) <> 'BLSA'
    and lower(t.name) not like '%bolsa%';

  if v_active_count < 15 then
    with next_players as (
      select lp.id
      from public.league_players lp
      join public.players p on p.id = lp.player_id
      join public.teams t on t.id = p.team_id
      where lp.league_id = p_league_id
        and lp.owner_user_id is null
        and lp.listed_by_user_id is null
        and lp.market_status = 'locked'
        and upper(t.short_name) <> 'BLSA'
        and lower(t.name) not like '%bolsa%'
      order by random()
      limit greatest(0, 15 - v_active_count)
    )
    update public.league_players lp
    set market_status = 'market',
        listed_by_user_id = null,
        market_listed_at = now(),
        market_expires_at = now() + interval '5 hours'
    where lp.id in (select id from next_players);

    insert into public.activity_feed (league_id, type, message, metadata_json)
    values (p_league_id, 'market', 'Mercado rotativo actualizado con hasta 15 jugadores.', jsonb_build_object('size', 15, 'duration_hours', 5));
  end if;
end;
$$;

create or replace function public.resolve_all_market_auctions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  for v_league_id in select id from public.leagues loop
    perform public.resolve_market_auctions(v_league_id);
  end loop;
end;
$$;

create or replace function public.submit_lineup(
  p_league_id uuid,
  p_matchday_id uuid,
  p_formation text,
  p_starters uuid[],
  p_bench uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lineup_id uuid;
  v_missing integer;
begin
  perform public.ensure_profile();

  if exists (select 1 from public.leagues where id = p_league_id and lineups_locked) then
    raise exception 'lineups_locked';
  end if;

  if not exists (select 1 from public.league_members where league_id = p_league_id and user_id = auth.uid()) then
    raise exception 'not_member';
  end if;

  if coalesce(array_length(p_starters, 1), 0) <> 11 then
    raise exception 'invalid_starter_count';
  end if;

  select count(*) into v_missing
  from unnest(p_starters || p_bench) as selected(player_id)
  where not exists (
    select 1 from public.league_players lp
    where lp.league_id = p_league_id and lp.player_id = selected.player_id and lp.owner_user_id = auth.uid()
  );

  if v_missing > 0 then
    raise exception 'lineup_contains_unowned_players';
  end if;

  insert into public.lineups (league_id, user_id, matchday_id, formation, status)
  values (p_league_id, auth.uid(), p_matchday_id, p_formation, 'submitted')
  on conflict (league_id, user_id, matchday_id)
  do update set formation = excluded.formation, status = 'submitted', created_at = now()
  returning id into v_lineup_id;

  delete from public.lineup_players where lineup_id = v_lineup_id;

  insert into public.lineup_players (lineup_id, player_id, slot, is_starter, position)
  select v_lineup_id, p.id, selected.ordinality - 1, true, p.position
  from unnest(p_starters) with ordinality as selected(player_id, ordinality)
  join public.players p on p.id = selected.player_id;

  insert into public.lineup_players (lineup_id, player_id, slot, is_starter, position)
  select v_lineup_id, p.id, 10 + selected.ordinality, false, p.position
  from unnest(p_bench) with ordinality as selected(player_id, ordinality)
  join public.players p on p.id = selected.player_id;

  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (p_league_id, 'lineup', 'Alineación guardada para la jornada.', jsonb_build_object('user_id', auth.uid(), 'matchday_id', p_matchday_id));

  return v_lineup_id;
end;
$$;

create or replace function public.recalculate_league_points(p_league_id uuid, p_matchday_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and not public.is_overload_admin()
    and not public.is_league_admin(p_league_id)
    and not public.is_league_member(p_league_id)
  then
    raise exception 'not_member';
  end if;

  with lineup_scores as (
    select
      l.user_id,
      md.number,
      md.id as matchday_id,
      coalesce(sum(
        case
          when p.status in ('lesionado', 'sancionado')
            and (p.unavailable_until_matchday is null or md.number <= p.unavailable_until_matchday)
          then 0
          else coalesce(pms.fantasy_points, 0) * case when l.captain_player_id = lp.player_id then 2 else 1 end
        end
      ), 0)::integer as points
    from public.lineups l
    join public.league_members lm on lm.league_id = l.league_id and lm.user_id = l.user_id
    join public.matchdays md on md.id = l.matchday_id
    join public.lineup_players lp on lp.lineup_id = l.id and lp.is_starter
    join public.players p on p.id = lp.player_id
    join public.matches m on m.matchday_id = md.id
    left join public.player_match_stats pms on pms.match_id = m.id and pms.player_id = lp.player_id
    where l.league_id = p_league_id
      and l.status in ('submitted', 'locked')
      and (p_matchday_id is null or md.id = p_matchday_id)
      and md.number >= coalesce(lm.joined_matchday, 1)
    group by l.user_id, md.number, md.id
  ),
  squad_scores as (
    select
      lp.owner_user_id as user_id,
      md.number,
      md.id as matchday_id,
      coalesce(sum(
        case
          when p.status in ('lesionado', 'sancionado')
            and (p.unavailable_until_matchday is null or md.number <= p.unavailable_until_matchday)
          then 0
          else coalesce(pms.fantasy_points, 0)
        end
      ), 0)::integer as points
    from public.league_players lp
    join public.league_members lm on lm.league_id = lp.league_id and lm.user_id = lp.owner_user_id
    join public.players p on p.id = lp.player_id
    join public.matchdays md on md.league_id = lp.league_id
    join public.matches m on m.matchday_id = md.id
    left join public.player_match_stats pms on pms.match_id = m.id and pms.player_id = lp.player_id
    where lp.league_id = p_league_id
      and lp.owner_user_id is not null
      and (p_matchday_id is null or md.id = p_matchday_id)
      and md.number >= coalesce(lm.joined_matchday, 1)
      and not exists (
        select 1
        from public.lineups existing
        where existing.league_id = p_league_id
          and existing.user_id = lp.owner_user_id
          and existing.matchday_id = md.id
          and existing.status in ('submitted', 'locked')
      )
    group by lp.owner_user_id, md.number, md.id
  ),
  combined_scores as (
    select user_id, number, points from lineup_scores
    union all
    select user_id, number, points from squad_scores
  ),
  totals as (
    select
      user_id,
      sum(points)::integer as total_points,
      jsonb_object_agg(number::text, points order by number) as points_by_matchday,
      coalesce((array_agg(points order by number desc))[1], 0)::integer as last_points
    from combined_scores
    group by user_id
  )
  update public.league_members lm
  set
    total_points = coalesce(t.total_points, 0),
    last_matchday_points = coalesce(t.last_points, 0),
    points_by_matchday = coalesce(t.points_by_matchday, '{}'::jsonb)
  from public.league_members base
  left join totals t on t.user_id = base.user_id
  where lm.id = base.id and base.league_id = p_league_id;

end;
$$;

create or replace function public.recalculate_player_totals_from_league(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and not public.is_overload_admin()
    and not public.is_league_admin(p_league_id)
  then
    raise exception 'not_admin';
  end if;

  with league_stats as (
    select pms.*, md.number
    from public.player_match_stats pms
    join public.matches m on m.id = pms.match_id
    join public.matchdays md on md.id = m.matchday_id
    where md.league_id = p_league_id
  ),
  matchday_points as (
    select player_id, number, sum(fantasy_points)::integer as points
    from league_stats
    group by player_id, number
  ),
  point_maps as (
    select player_id, jsonb_object_agg(number::text, points order by number) as points_by_matchday
    from matchday_points
    group by player_id
  ),
  totals as (
    select
      p.id as player_id,
      coalesce(sum(ls.fantasy_points), 0)::integer as total_points,
      count(ls.player_id) filter (
        where coalesce(ls.minutes, 0) > 0
          or coalesce(ls.goals, 0) <> 0
          or coalesce(ls.assists, 0) <> 0
          or coalesce(ls.key_passes, 0) <> 0
          or coalesce(ls.yellow_cards, 0) <> 0
          or coalesce(ls.red_cards, 0) <> 0
          or coalesce(ls.double_yellow_cards, 0) <> 0
          or coalesce(ls.own_goals, 0) <> 0
          or coalesce(ls.penalties_scored, 0) <> 0
          or coalesce(ls.penalties_missed, 0) <> 0
          or coalesce(ls.penalties_saved, 0) <> 0
          or coalesce(ls.penalties_provoked, 0) <> 0
          or coalesce(ls.saves, 0) <> 0
          or coalesce(ls.shots_on_target, 0) <> 0
          or coalesce(ls.successful_dribbles, 0) <> 0
          or coalesce(ls.box_entries, 0) <> 0
          or coalesce(ls.balls_lost, 0) <> 0
          or coalesce(ls.balls_recovered, 0) <> 0
          or coalesce(ls.clearances, 0) <> 0
          or coalesce(ls.overload_score, 0) > 0
          or coalesce(ls.overload_rating, 0) > 0
          or coalesce(ls.mvp, false)
          or coalesce(ls.highlighted, false)
          or coalesce(ls.error_led_to_goal, false)
      )::integer as appearances,
      coalesce(sum(ls.goals), 0)::integer as goals,
      coalesce(sum(ls.assists), 0)::integer as assists,
      coalesce(sum(ls.key_passes), 0)::integer as key_passes,
      coalesce(sum(ls.goals_conceded), 0)::integer as goals_conceded,
      coalesce(count(ls.player_id) filter (where ls.clean_sheet and coalesce(ls.minutes, 0) > 60), 0)::integer as clean_sheets,
      coalesce(sum(ls.yellow_cards), 0)::integer as yellow_cards,
      coalesce(sum(ls.red_cards), 0)::integer as red_cards,
      coalesce(sum(ls.double_yellow_cards), 0)::integer as double_yellow_cards,
      coalesce(sum(ls.penalties_scored), 0)::integer as penalties_scored,
      coalesce(sum(ls.penalties_missed), 0)::integer as penalties_missed,
      coalesce(sum(ls.penalties_saved), 0)::integer as penalties_saved,
      coalesce(sum(ls.penalties_provoked), 0)::integer as penalties_provoked,
      coalesce(sum(ls.own_goals), 0)::integer as own_goals,
      coalesce(sum(ls.overload_rating), 0)::integer as overload_points,
      coalesce(sum(ls.minutes), 0)::integer as minutes,
      coalesce(sum(ls.key_passes + ls.assists + ls.goals + ls.penalties_provoked + ls.penalties_saved), 0)::integer as key_actions,
      coalesce(sum(ls.saves), 0)::integer as saves,
      coalesce(sum(ls.shots_on_target), 0)::integer as shots_on_target,
      coalesce(sum(ls.successful_dribbles), 0)::integer as successful_dribbles,
      coalesce(sum(ls.box_entries), 0)::integer as box_entries,
      coalesce(sum(ls.balls_lost), 0)::integer as balls_lost,
      coalesce(sum(ls.balls_recovered), 0)::integer as balls_recovered,
      coalesce(sum(ls.clearances), 0)::integer as clearances
    from public.players p
    left join league_stats ls on ls.player_id = p.id
    group by p.id
  )
  update public.players p
  set total_points = t.total_points,
      points_by_matchday = coalesce(pm.points_by_matchday, '{}'::jsonb),
      fantasy_value = case when t.appearances > 0 then round((t.total_points::numeric / t.appearances) * 10) / 10 else 0 end,
      stats_json = coalesce(p.stats_json, '{}'::jsonb) || jsonb_build_object(
        'appearances', t.appearances,
        'goals', t.goals,
        'assists', t.assists,
        'keyPasses', t.key_passes,
        'goalsConceded', t.goals_conceded,
        'cleanSheets', t.clean_sheets,
        'yellowCards', t.yellow_cards,
        'redCards', t.red_cards,
        'doubleYellowCards', t.double_yellow_cards,
        'penaltiesScored', t.penalties_scored,
        'penaltiesMissed', t.penalties_missed,
        'penaltiesSaved', t.penalties_saved,
        'penaltiesProvoked', t.penalties_provoked,
        'ownGoals', t.own_goals,
        'overloadPoints', t.overload_points,
        'minutes', t.minutes,
        'keyActions', t.key_actions,
        'saves', t.saves,
        'shotsOnTarget', t.shots_on_target,
        'successfulDribbles', t.successful_dribbles,
        'boxEntries', t.box_entries,
        'ballsLost', t.balls_lost,
        'ballsRecovered', t.balls_recovered,
        'clearances', t.clearances
      )
  from totals t
  left join point_maps pm on pm.player_id = t.player_id
  where p.id = t.player_id;
end;
$$;

create or replace function public.calculate_points_sql(
  p_position text,
  p_minutes integer,
  p_goals integer,
  p_assists integer,
  p_key_passes integer,
  p_yellow_cards integer,
  p_red_cards integer,
  p_double_yellow_cards integer,
  p_own_goals integer,
  p_penalties_scored integer,
  p_penalties_missed integer,
  p_penalties_saved integer,
  p_penalties_provoked integer,
  p_goals_conceded integer,
  p_clean_sheet boolean,
  p_overload_score numeric,
  p_overload_rating integer,
  p_mvp boolean,
  p_team_won boolean,
  p_team_lost boolean,
  p_highlighted boolean,
  p_error_led_to_goal boolean,
  p_saves integer,
  p_shots_on_target integer,
  p_successful_dribbles integer,
  p_box_entries integer,
  p_balls_lost integer,
  p_balls_recovered integer,
  p_clearances integer,
  p_rules jsonb
)
returns integer
language plpgsql
immutable
as $$
declare
  v_points integer := 0;
  v_conceded_rule integer := 0;
  v_double_yellow integer := 0;
  v_direct_red integer := 0;
  v_overload integer := 0;
begin
  v_double_yellow := greatest(coalesce(p_double_yellow_cards, 0), least(coalesce(p_yellow_cards, 0), coalesce(p_red_cards, 0)));
  v_direct_red := greatest(coalesce(p_red_cards, 0) - v_double_yellow, 0);
  v_overload := case
    when p_overload_score is not null and p_overload_score >= 8.5 then 4
    when p_overload_score is not null and p_overload_score >= 7 then 3
    when p_overload_score is not null and p_overload_score >= 5.5 then 2
    when p_overload_score is not null and p_overload_score >= 4 then 1
    when p_overload_score is not null then 0
    else least(greatest(coalesce(p_overload_rating, 0), 0), 4)
  end;

  if coalesce(p_minutes, 0) > 60 then
    v_points := v_points + coalesce((p_rules ->> 'playedOver60')::integer, coalesce((p_rules ->> 'sixtyMinutes')::integer, 2));
  elsif coalesce(p_minutes, 0) > 0 then
    v_points := v_points + coalesce((p_rules ->> 'playedUnder60')::integer, coalesce((p_rules ->> 'played')::integer, 1));
  end if;

  v_points := v_points + p_goals * coalesce((p_rules -> 'goal' ->> p_position)::integer, 0);
  v_points := v_points + p_assists * coalesce((p_rules ->> 'assist')::integer, 3);
  v_points := v_points + coalesce(p_key_passes, 0) * coalesce((p_rules ->> 'keyPass')::integer, 1);
  if p_clean_sheet and coalesce(p_minutes, 0) > 60 then v_points := v_points + coalesce((p_rules -> 'cleanSheet' ->> p_position)::integer, 0); end if;

  if jsonb_typeof(p_rules -> 'goalsConcededEveryTwo') = 'object' then
    v_conceded_rule := coalesce((p_rules -> 'goalsConcededEveryTwo' ->> p_position)::integer, 0);
  elsif p_position in ('POR', 'DEF') then
    v_conceded_rule := coalesce((p_rules ->> 'goalsConcededEveryTwo')::integer, -1);
  end if;
  v_points := v_points + floor(coalesce(p_goals_conceded, 0) / 2)::integer * v_conceded_rule;

  v_points := v_points + p_yellow_cards * coalesce((p_rules ->> 'yellowCard')::integer, -1);
  v_points := v_points + v_double_yellow * coalesce((p_rules ->> 'doubleYellowCard')::integer, -1);
  v_points := v_points + v_direct_red * coalesce((p_rules ->> 'redCard')::integer, -3);
  v_points := v_points + p_own_goals * coalesce((p_rules ->> 'ownGoal')::integer, -2);
  v_points := v_points + p_penalties_missed * coalesce((p_rules ->> 'penaltyMissed')::integer, -2);
  v_points := v_points + p_penalties_saved * coalesce((p_rules ->> 'penaltySaved')::integer, 5);
  v_points := v_points + p_penalties_provoked * coalesce((p_rules ->> 'penaltyProvoked')::integer, 2);
  if p_position = 'POR' then
    v_points := v_points + floor(coalesce(p_saves, 0) / 2)::integer * coalesce((p_rules ->> 'savesEveryTwo')::integer, 1);
  end if;
  v_points := v_points + coalesce((p_rules -> 'overloadRating' ->> v_overload::text)::integer, v_overload, 0);
  v_points := v_points + floor(coalesce(p_shots_on_target, 0) / 2)::integer * coalesce((p_rules ->> 'shotsOnTargetEveryTwo')::integer, 1);
  v_points := v_points + floor(coalesce(p_successful_dribbles, 0) / 2)::integer * coalesce((p_rules ->> 'successfulDribblesEveryTwo')::integer, 1);
  v_points := v_points + floor(coalesce(p_box_entries, 0) / 2)::integer * coalesce((p_rules ->> 'boxEntriesEveryTwo')::integer, 1);
  v_points := v_points + coalesce(p_balls_lost, 0) * coalesce((p_rules ->> 'ballsLostEach')::integer, (p_rules ->> 'ballsLostEveryTen')::integer, -1);
  v_points := v_points + coalesce(p_balls_recovered, 0) * coalesce((p_rules ->> 'ballsRecoveredEach')::integer, 1);
  v_points := v_points + coalesce(p_clearances, 0) * coalesce((p_rules ->> 'clearancesEach')::integer, 1);
  return v_points;
end;
$$;

create or replace function public.simulate_matchday(p_league_id uuid, p_matchday_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match record;
  v_player record;
  v_home_score integer;
  v_away_score integer;
  v_minutes integer;
  v_goals integer;
  v_assists integer;
  v_yellow integer;
  v_red integer;
  v_gc integer;
  v_clean boolean;
  v_won boolean;
  v_lost boolean;
  v_points integer;
  v_rules jsonb;
  v_mvp_player uuid;
begin
  if not public.is_league_admin(p_league_id) then
    raise exception 'admin_required';
  end if;

  select rules_json into v_rules from public.scoring_rules where league_id = p_league_id;
  v_rules := coalesce(v_rules, public.default_scoring_rules());

  update public.matchdays set status = 'en_curso' where id = p_matchday_id and league_id = p_league_id;

  for v_match in
    select m.*, ht.strength as home_strength, at.strength as away_strength
    from public.matches m
    join public.teams ht on ht.id = m.home_team_id
    join public.teams at on at.id = m.away_team_id
    join public.matchdays md on md.id = m.matchday_id
    where m.matchday_id = p_matchday_id and md.league_id = p_league_id
  loop
    v_home_score := greatest(0, least(5, floor(random() * 3.2 + ((v_match.home_strength - v_match.away_strength)::numeric / 35))::integer));
    v_away_score := greatest(0, least(5, floor(random() * 3.2 + ((v_match.away_strength - v_match.home_strength)::numeric / 35))::integer));

    update public.matches
    set home_score = v_home_score, away_score = v_away_score, status = 'finalizada', played_at = now()
    where id = v_match.id;

    delete from public.player_match_stats where match_id = v_match.id;

    v_mvp_player := null;

    for v_player in
      select p.*
      from public.players p
      where p.team_id in (v_match.home_team_id, v_match.away_team_id)
      order by p.position, p.current_price desc
      limit 36
    loop
      v_minutes := case when random() < 0.82 then 60 + floor(random() * 31)::integer else floor(random() * 45)::integer end;
      v_goals := case
        when v_player.position = 'DEL' and random() < 0.32 then 1
        when v_player.position = 'MED' and random() < 0.18 then 1
        when v_player.position = 'DEF' and random() < 0.08 then 1
        when v_player.position = 'POR' and random() < 0.01 then 1
        else 0
      end;
      v_assists := case
        when v_player.position = 'MED' and random() < 0.32 then 1
        when v_player.position = 'DEL' and random() < 0.18 then 1
        when v_player.position = 'DEF' and random() < 0.10 then 1
        else 0
      end;
      v_yellow := case when random() < 0.13 then 1 else 0 end;
      v_red := case when random() < 0.018 then 1 else 0 end;
      v_gc := case when v_player.team_id = v_match.home_team_id then v_away_score else v_home_score end;
      v_clean := v_minutes > 0 and v_gc = 0;
      v_won := (v_player.team_id = v_match.home_team_id and v_home_score > v_away_score) or (v_player.team_id = v_match.away_team_id and v_away_score > v_home_score);
      v_lost := (v_player.team_id = v_match.home_team_id and v_home_score < v_away_score) or (v_player.team_id = v_match.away_team_id and v_away_score < v_home_score);

      if v_mvp_player is null and (v_goals > 0 or v_assists > 0 or (v_player.position = 'POR' and v_clean)) then
        v_mvp_player := v_player.id;
      end if;

      v_points := public.calculate_points_sql(
        v_player.position,
        v_minutes,
        v_goals,
        v_assists,
        0,
        v_yellow,
        v_red,
        case when v_yellow > 0 and v_red > 0 then 1 else 0 end,
        0,
        case when random() < 0.04 and v_goals > 0 then 1 else 0 end,
        case when random() < 0.025 then 1 else 0 end,
        case when v_player.position = 'POR' and random() < 0.025 then 1 else 0 end,
        0,
        v_gc,
        v_clean,
        null,
        least(4, greatest(1, 1 + v_goals + v_assists + case when v_clean then 1 else 0 end - v_red)),
        false,
        v_won,
        v_lost,
        random() < 0.08,
        random() < 0.02,
        case when v_player.position = 'POR' then floor(random() * 7)::integer else 0 end,
        floor(random() * 5)::integer,
        floor(random() * 5)::integer,
        floor(random() * 4)::integer,
        floor(random() * 12)::integer,
        floor(random() * 8)::integer,
        floor(random() * 8)::integer,
        v_rules
      );

      insert into public.player_match_stats (
        match_id, player_id, minutes, goals, assists, key_passes, yellow_cards, red_cards, double_yellow_cards, goals_conceded,
        clean_sheet, overload_rating, team_won, team_lost, highlighted, error_led_to_goal,
        saves, shots_on_target, successful_dribbles, box_entries, balls_lost, balls_recovered, clearances, fantasy_points
      )
      values (
        v_match.id, v_player.id, v_minutes, v_goals, v_assists, 0, v_yellow, v_red, case when v_yellow > 0 and v_red > 0 then 1 else 0 end, v_gc,
        v_clean, least(4, greatest(1, 1 + v_goals + v_assists + case when v_clean then 1 else 0 end - v_red)), v_won, v_lost, random() < 0.08, random() < 0.02,
        case when v_player.position = 'POR' then floor(random() * 7)::integer else 0 end,
        floor(random() * 5)::integer,
        floor(random() * 5)::integer,
        floor(random() * 4)::integer,
        floor(random() * 12)::integer,
        floor(random() * 8)::integer,
        floor(random() * 8)::integer,
        v_points
      );
    end loop;

    if v_mvp_player is not null then
      update public.player_match_stats pms
      set mvp = true
      where pms.match_id = v_match.id and pms.player_id = v_mvp_player;
    end if;
  end loop;

  update public.matchdays set status = 'finalizada', ends_at = now() where id = p_matchday_id;
  update public.leagues set current_matchday = current_matchday + 1 where id = p_league_id;

  update public.players p
  set total_points = p.total_points + coalesce(agg.points, 0),
      points_by_matchday = p.points_by_matchday || jsonb_build_object((select number from public.matchdays where id = p_matchday_id)::text, coalesce(agg.points, 0))
  from (
    select player_id, sum(fantasy_points)::integer as points
    from public.player_match_stats pms
    join public.matches m on m.id = pms.match_id
    where m.matchday_id = p_matchday_id
    group by player_id
  ) agg
  where p.id = agg.player_id;

  perform public.recalculate_league_points(p_league_id);

  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (p_league_id, 'matchday_simulated', 'Jornada simulada y clasificación recalculada.', jsonb_build_object('matchday_id', p_matchday_id));
end;
$$;

create or replace function public.update_match_result(
  p_match_id uuid,
  p_home_score integer,
  p_away_score integer,
  p_player_stats jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league_id uuid;
  v_matchday_id uuid;
  v_stat jsonb;
  v_player public.players%rowtype;
  v_points integer;
  v_rules jsonb;
  v_scoring_position text;
begin
  select md.league_id, md.id into v_league_id, v_matchday_id
  from public.matches m
  join public.matchdays md on md.id = m.matchday_id
  where m.id = p_match_id;

  if coalesce(auth.role(), '') <> 'service_role' and not public.is_league_admin(v_league_id) then
    raise exception 'admin_required';
  end if;

  select rules_json into v_rules from public.scoring_rules where league_id = v_league_id;
  v_rules := coalesce(v_rules, public.default_scoring_rules());

  update public.matches
  set home_score = p_home_score, away_score = p_away_score, status = 'finalizada', played_at = now()
  where id = p_match_id;

  delete from public.player_match_stats where match_id = p_match_id;

  for v_stat in select * from jsonb_array_elements(coalesce(p_player_stats, '[]'::jsonb))
  loop
    select * into v_player from public.players where id = coalesce(v_stat ->> 'playerId', v_stat ->> 'player_id')::uuid;
    if found then
      v_scoring_position := coalesce(v_stat ->> 'scoringPosition', v_stat ->> 'scoring_position', v_player.position);
      if v_scoring_position not in ('POR', 'DEF', 'MED', 'DEL')
        or not v_scoring_position = any(case when cardinality(v_player.positions) > 0 then v_player.positions else array[v_player.position] end)
      then
        v_scoring_position := v_player.position;
      end if;

      v_points := public.calculate_points_sql(
        v_scoring_position,
        coalesce((v_stat ->> 'minutes')::integer, 0),
        coalesce((v_stat ->> 'goals')::integer, 0),
        coalesce((v_stat ->> 'assists')::integer, 0),
        coalesce((v_stat ->> 'keyPasses')::integer, (v_stat ->> 'key_passes')::integer, 0),
        coalesce((v_stat ->> 'yellowCards')::integer, (v_stat ->> 'yellow_cards')::integer, 0),
        coalesce((v_stat ->> 'redCards')::integer, (v_stat ->> 'red_cards')::integer, 0),
        coalesce((v_stat ->> 'doubleYellowCards')::integer, (v_stat ->> 'double_yellow_cards')::integer, 0),
        coalesce((v_stat ->> 'ownGoals')::integer, (v_stat ->> 'own_goals')::integer, 0),
        coalesce((v_stat ->> 'penaltiesScored')::integer, (v_stat ->> 'penalties_scored')::integer, 0),
        coalesce((v_stat ->> 'penaltiesMissed')::integer, (v_stat ->> 'penalties_missed')::integer, 0),
        coalesce((v_stat ->> 'penaltiesSaved')::integer, (v_stat ->> 'penalties_saved')::integer, 0),
        coalesce((v_stat ->> 'penaltiesProvoked')::integer, (v_stat ->> 'penalties_provoked')::integer, 0),
        coalesce((v_stat ->> 'goalsConceded')::integer, (v_stat ->> 'goals_conceded')::integer, 0),
        coalesce((v_stat ->> 'cleanSheet')::boolean, (v_stat ->> 'clean_sheet')::boolean, false),
        coalesce((v_stat ->> 'overloadScore')::numeric, (v_stat ->> 'overload_score')::numeric),
        coalesce((v_stat ->> 'overloadRating')::integer, (v_stat ->> 'overload_rating')::integer, 0),
        coalesce((v_stat ->> 'mvp')::boolean, false),
        coalesce((v_stat ->> 'teamWon')::boolean, (v_stat ->> 'team_won')::boolean, false),
        coalesce((v_stat ->> 'teamLost')::boolean, (v_stat ->> 'team_lost')::boolean, false),
        coalesce((v_stat ->> 'highlighted')::boolean, false),
        coalesce((v_stat ->> 'errorLedToGoal')::boolean, (v_stat ->> 'error_led_to_goal')::boolean, false),
        coalesce((v_stat ->> 'saves')::integer, 0),
        coalesce((v_stat ->> 'shotsOnTarget')::integer, (v_stat ->> 'shots_on_target')::integer, 0),
        coalesce((v_stat ->> 'successfulDribbles')::integer, (v_stat ->> 'successful_dribbles')::integer, 0),
        coalesce((v_stat ->> 'boxEntries')::integer, (v_stat ->> 'box_entries')::integer, 0),
        coalesce((v_stat ->> 'ballsLost')::integer, (v_stat ->> 'balls_lost')::integer, 0),
        coalesce((v_stat ->> 'ballsRecovered')::integer, (v_stat ->> 'balls_recovered')::integer, 0),
        coalesce((v_stat ->> 'clearances')::integer, 0),
        v_rules
      );

      insert into public.player_match_stats (
        match_id, player_id, scoring_position, minutes, goals, assists, key_passes, yellow_cards, red_cards, double_yellow_cards, own_goals,
        penalties_scored, penalties_missed, penalties_saved, penalties_provoked, goals_conceded, clean_sheet, overload_score, overload_rating, mvp,
        team_won, team_lost, highlighted, error_led_to_goal, saves, shots_on_target, successful_dribbles, box_entries,
        balls_lost, balls_recovered, clearances, fantasy_points, manual_override, updated_by, updated_at
      )
      values (
        p_match_id,
        v_player.id,
        v_scoring_position,
        coalesce((v_stat ->> 'minutes')::integer, 0),
        coalesce((v_stat ->> 'goals')::integer, 0),
        coalesce((v_stat ->> 'assists')::integer, 0),
        coalesce((v_stat ->> 'keyPasses')::integer, (v_stat ->> 'key_passes')::integer, 0),
        coalesce((v_stat ->> 'yellowCards')::integer, (v_stat ->> 'yellow_cards')::integer, 0),
        coalesce((v_stat ->> 'redCards')::integer, (v_stat ->> 'red_cards')::integer, 0),
        coalesce((v_stat ->> 'doubleYellowCards')::integer, (v_stat ->> 'double_yellow_cards')::integer, 0),
        coalesce((v_stat ->> 'ownGoals')::integer, (v_stat ->> 'own_goals')::integer, 0),
        coalesce((v_stat ->> 'penaltiesScored')::integer, (v_stat ->> 'penalties_scored')::integer, 0),
        coalesce((v_stat ->> 'penaltiesMissed')::integer, (v_stat ->> 'penalties_missed')::integer, 0),
        coalesce((v_stat ->> 'penaltiesSaved')::integer, (v_stat ->> 'penalties_saved')::integer, 0),
        coalesce((v_stat ->> 'penaltiesProvoked')::integer, (v_stat ->> 'penalties_provoked')::integer, 0),
        coalesce((v_stat ->> 'goalsConceded')::integer, (v_stat ->> 'goals_conceded')::integer, 0),
        coalesce((v_stat ->> 'cleanSheet')::boolean, (v_stat ->> 'clean_sheet')::boolean, false),
        coalesce((v_stat ->> 'overloadScore')::numeric, (v_stat ->> 'overload_score')::numeric),
        coalesce((v_stat ->> 'overloadRating')::integer, (v_stat ->> 'overload_rating')::integer, 0),
        coalesce((v_stat ->> 'mvp')::boolean, false),
        coalesce((v_stat ->> 'teamWon')::boolean, (v_stat ->> 'team_won')::boolean, false),
        coalesce((v_stat ->> 'teamLost')::boolean, (v_stat ->> 'team_lost')::boolean, false),
        coalesce((v_stat ->> 'highlighted')::boolean, false),
        coalesce((v_stat ->> 'errorLedToGoal')::boolean, (v_stat ->> 'error_led_to_goal')::boolean, false),
        coalesce((v_stat ->> 'saves')::integer, 0),
        coalesce((v_stat ->> 'shotsOnTarget')::integer, (v_stat ->> 'shots_on_target')::integer, 0),
        coalesce((v_stat ->> 'successfulDribbles')::integer, (v_stat ->> 'successful_dribbles')::integer, 0),
        coalesce((v_stat ->> 'boxEntries')::integer, (v_stat ->> 'box_entries')::integer, 0),
        coalesce((v_stat ->> 'ballsLost')::integer, (v_stat ->> 'balls_lost')::integer, 0),
        coalesce((v_stat ->> 'ballsRecovered')::integer, (v_stat ->> 'balls_recovered')::integer, 0),
        coalesce((v_stat ->> 'clearances')::integer, 0),
        v_points,
        coalesce((v_stat ->> 'manualOverride')::boolean, (v_stat ->> 'manual_override')::boolean, false),
        auth.uid(),
        now()
      );
    end if;
  end loop;

  with league_stats as (
    select pms.*, md.number
    from public.player_match_stats pms
    join public.matches m on m.id = pms.match_id
    join public.matchdays md on md.id = m.matchday_id
    where md.league_id = v_league_id
  ),
  matchday_points as (
    select player_id, number, sum(fantasy_points)::integer as points
    from league_stats
    group by player_id, number
  ),
  point_maps as (
    select player_id, jsonb_object_agg(number::text, points order by number) as points_by_matchday
    from matchday_points
    group by player_id
  ),
  totals as (
    select
      p.id as player_id,
      coalesce(sum(ls.fantasy_points), 0)::integer as total_points,
      count(ls.player_id) filter (
        where coalesce(ls.minutes, 0) > 0
          or coalesce(ls.goals, 0) <> 0
          or coalesce(ls.assists, 0) <> 0
          or coalesce(ls.key_passes, 0) <> 0
          or coalesce(ls.yellow_cards, 0) <> 0
          or coalesce(ls.red_cards, 0) <> 0
          or coalesce(ls.double_yellow_cards, 0) <> 0
          or coalesce(ls.own_goals, 0) <> 0
          or coalesce(ls.penalties_scored, 0) <> 0
          or coalesce(ls.penalties_missed, 0) <> 0
          or coalesce(ls.penalties_saved, 0) <> 0
          or coalesce(ls.penalties_provoked, 0) <> 0
          or coalesce(ls.saves, 0) <> 0
          or coalesce(ls.shots_on_target, 0) <> 0
          or coalesce(ls.successful_dribbles, 0) <> 0
          or coalesce(ls.box_entries, 0) <> 0
          or coalesce(ls.balls_lost, 0) <> 0
          or coalesce(ls.balls_recovered, 0) <> 0
          or coalesce(ls.clearances, 0) <> 0
          or coalesce(ls.overload_score, 0) > 0
          or coalesce(ls.overload_rating, 0) > 0
          or coalesce(ls.mvp, false)
          or coalesce(ls.highlighted, false)
          or coalesce(ls.error_led_to_goal, false)
      )::integer as appearances,
      coalesce(sum(ls.goals), 0)::integer as goals,
      coalesce(sum(ls.assists), 0)::integer as assists,
      coalesce(sum(ls.key_passes), 0)::integer as key_passes,
      coalesce(sum(ls.goals_conceded), 0)::integer as goals_conceded,
      coalesce(count(ls.player_id) filter (where ls.clean_sheet and coalesce(ls.minutes, 0) > 60), 0)::integer as clean_sheets,
      coalesce(sum(ls.yellow_cards), 0)::integer as yellow_cards,
      coalesce(sum(ls.red_cards), 0)::integer as red_cards,
      coalesce(sum(ls.double_yellow_cards), 0)::integer as double_yellow_cards,
      coalesce(sum(ls.penalties_scored), 0)::integer as penalties_scored,
      coalesce(sum(ls.penalties_missed), 0)::integer as penalties_missed,
      coalesce(sum(ls.penalties_saved), 0)::integer as penalties_saved,
      coalesce(sum(ls.penalties_provoked), 0)::integer as penalties_provoked,
      coalesce(sum(ls.own_goals), 0)::integer as own_goals,
      coalesce(sum(ls.overload_rating), 0)::integer as overload_points,
      coalesce(sum(ls.minutes), 0)::integer as minutes,
      coalesce(sum(ls.key_passes + ls.assists + ls.goals + ls.penalties_provoked + ls.penalties_saved), 0)::integer as key_actions,
      coalesce(sum(ls.saves), 0)::integer as saves,
      coalesce(sum(ls.shots_on_target), 0)::integer as shots_on_target,
      coalesce(sum(ls.successful_dribbles), 0)::integer as successful_dribbles,
      coalesce(sum(ls.box_entries), 0)::integer as box_entries,
      coalesce(sum(ls.balls_lost), 0)::integer as balls_lost,
      coalesce(sum(ls.balls_recovered), 0)::integer as balls_recovered,
      coalesce(sum(ls.clearances), 0)::integer as clearances
    from public.players p
    left join league_stats ls on ls.player_id = p.id
    group by p.id
  )
  update public.players p
  set total_points = t.total_points,
      points_by_matchday = coalesce(pm.points_by_matchday, '{}'::jsonb),
      fantasy_value = case when t.appearances > 0 then round((t.total_points::numeric / t.appearances) * 10) / 10 else 0 end,
      stats_json = coalesce(p.stats_json, '{}'::jsonb) || jsonb_build_object(
        'appearances', t.appearances,
        'goals', t.goals,
        'assists', t.assists,
        'keyPasses', t.key_passes,
        'goalsConceded', t.goals_conceded,
        'cleanSheets', t.clean_sheets,
        'yellowCards', t.yellow_cards,
        'redCards', t.red_cards,
        'doubleYellowCards', t.double_yellow_cards,
        'penaltiesScored', t.penalties_scored,
        'penaltiesMissed', t.penalties_missed,
        'penaltiesSaved', t.penalties_saved,
        'penaltiesProvoked', t.penalties_provoked,
        'ownGoals', t.own_goals,
        'overloadPoints', t.overload_points,
        'minutes', t.minutes,
        'keyActions', t.key_actions,
        'saves', t.saves,
        'shotsOnTarget', t.shots_on_target,
        'successfulDribbles', t.successful_dribbles,
        'boxEntries', t.box_entries,
        'ballsLost', t.balls_lost,
        'ballsRecovered', t.balls_recovered,
        'clearances', t.clearances
      )
  from totals t
  left join point_maps pm on pm.player_id = t.player_id
  where p.id = t.player_id;

  perform public.recalculate_player_market_values();
  perform public.recalculate_league_points(v_league_id);
  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (v_league_id, 'match_updated', 'Resultado actualizado manualmente.', jsonb_build_object('match_id', p_match_id));
end;
$$;

create or replace function public.accept_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offers%rowtype;
  v_lp public.league_players%rowtype;
  v_exchange_lp public.league_players%rowtype;
  v_buyer public.league_members%rowtype;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found or v_offer.status <> 'pending' then raise exception 'offer_not_pending'; end if;
  if v_offer.to_user_id <> auth.uid() then raise exception 'not_offer_receiver'; end if;

  select * into v_lp from public.league_players where league_id = v_offer.league_id and player_id = v_offer.player_id for update;
  if v_lp.owner_user_id <> auth.uid() then raise exception 'not_player_owner'; end if;

  select * into v_buyer
  from public.league_members
  where league_id = v_offer.league_id and user_id = v_offer.from_user_id
  for update;

  if not found then
    raise exception 'buyer_not_member';
  end if;

  if v_buyer.budget < v_offer.amount then
    raise exception 'buyer_not_enough_budget';
  end if;

  if v_offer.kind = 'exchange' then
    if v_offer.exchange_player_id is null then
      raise exception 'exchange_player_required';
    end if;

    select * into v_exchange_lp
    from public.league_players
    where league_id = v_offer.league_id and player_id = v_offer.exchange_player_id
    for update;

    if not found or v_exchange_lp.owner_user_id <> v_offer.from_user_id then
      raise exception 'exchange_player_not_owned';
    end if;
  end if;

  update public.league_members set budget = budget - v_offer.amount where league_id = v_offer.league_id and user_id = v_offer.from_user_id;
  update public.league_members set budget = budget + v_offer.amount where league_id = v_offer.league_id and user_id = auth.uid();
  update public.league_players
  set owner_user_id = v_offer.from_user_id,
      listed_by_user_id = null,
      price = greatest(v_offer.amount, v_lp.price),
      release_clause = public.default_release_clause(greatest(v_offer.amount, v_lp.price)),
      clause_locked_until = now() + interval '5 days'
  where id = v_lp.id;

  delete from public.squads where league_id = v_offer.league_id and user_id = auth.uid() and player_id = v_offer.player_id;
  insert into public.squads (league_id, user_id, player_id, acquired_price)
  values (v_offer.league_id, v_offer.from_user_id, v_offer.player_id, greatest(v_offer.amount, v_lp.price))
  on conflict (league_id, user_id, player_id) do update set acquired_price = excluded.acquired_price, acquired_at = now();

  if v_offer.kind = 'exchange' then
    update public.league_players
    set owner_user_id = auth.uid(),
        listed_by_user_id = null,
        release_clause = public.default_release_clause(price),
        clause_locked_until = now() + interval '5 days'
    where id = v_exchange_lp.id;

    delete from public.squads where league_id = v_offer.league_id and user_id = v_offer.from_user_id and player_id = v_offer.exchange_player_id;
    insert into public.squads (league_id, user_id, player_id, acquired_price)
    values (v_offer.league_id, auth.uid(), v_offer.exchange_player_id, v_exchange_lp.price)
    on conflict (league_id, user_id, player_id) do update set acquired_price = excluded.acquired_price, acquired_at = now();

    delete from public.lineup_players lp
    using public.lineups l
    where l.id = lp.lineup_id
      and l.league_id = v_offer.league_id
      and l.user_id = v_offer.from_user_id
      and l.status = 'draft'
      and lp.player_id = v_offer.exchange_player_id;

    insert into public.transfers (league_id, user_id, player_id, type, amount)
    values (v_offer.league_id, auth.uid(), v_offer.exchange_player_id, 'offer_accepted', v_exchange_lp.price);
  end if;

  delete from public.lineup_players lp
  using public.lineups l
  where l.id = lp.lineup_id
    and l.league_id = v_offer.league_id
    and l.user_id = auth.uid()
    and l.status = 'draft'
    and lp.player_id = v_offer.player_id;

  update public.offers set status = 'accepted' where id = p_offer_id;
  insert into public.transfers (league_id, user_id, player_id, type, amount)
  values (v_offer.league_id, v_offer.from_user_id, v_offer.player_id, 'offer_accepted', greatest(v_offer.amount, v_lp.price));
end;
$$;

create or replace function public.reject_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.offers
  set status = 'rejected'
  where id = p_offer_id
    and status = 'pending'
    and (to_user_id = auth.uid() or from_user_id = auth.uid());

  if not found then
    raise exception 'offer_not_found_or_forbidden';
  end if;
end;
$$;

alter table public.players
  add column if not exists unavailable_until_matchday integer,
  add column if not exists positions text[];

update public.players
set positions = array[position]
where positions is null or cardinality(positions) = 0;

alter table public.players
  alter column positions set default array['MED']::text[],
  alter column positions set not null;

alter table public.lineups
  add column if not exists captain_player_id uuid references public.players(id) on delete set null;

create or replace function public.is_overload_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.email(), '') ilike 'pablogarvac%';
$$;

create or replace function public.admin_update_player_availability(
  p_player_id uuid,
  p_status text,
  p_unavailable_until_matchday integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league_id uuid;
begin
  if not public.is_overload_admin() then
    raise exception 'overload_admin_required';
  end if;

  if p_status not in ('disponible', 'lesionado', 'sancionado', 'duda') then
    raise exception 'invalid_status';
  end if;

  update public.players
  set
    status = p_status,
    unavailable_until_matchday = case
      when p_status in ('lesionado', 'sancionado') then p_unavailable_until_matchday
      else null
    end
  where id = p_player_id;

  if not found then
    raise exception 'player_not_found';
  end if;

  for v_league_id in select id from public.leagues loop
    perform public.recalculate_league_points(v_league_id, null);
  end loop;
end;
$$;

create or replace function public.admin_set_current_matchday(p_league_id uuid, p_matchday_number integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_matchday integer;
begin
  if not public.is_overload_admin() then
    raise exception 'overload_admin_required';
  end if;
  if p_matchday_number < 1 then
    raise exception 'invalid_matchday';
  end if;
  if not exists (select 1 from public.leagues where id = p_league_id) then
    raise exception 'league_not_found';
  end if;

  v_max_matchday := greatest(13, p_matchday_number);

  insert into public.matchdays (league_id, number, status, starts_at)
  select p_league_id, generated.number, 'pendiente', now() + ((generated.number - p_matchday_number) * interval '7 days')
  from generate_series(1, v_max_matchday) as generated(number)
  on conflict (league_id, number) do nothing;

  update public.matchdays
  set status = 'finalizada',
      ends_at = coalesce(ends_at, now())
  where league_id = p_league_id
    and number < p_matchday_number;

  update public.matchdays
  set status = 'pendiente',
      starts_at = coalesce(starts_at, now()),
      ends_at = null
  where league_id = p_league_id
    and number = p_matchday_number;

  update public.matchdays
  set status = 'pendiente',
      ends_at = null
  where league_id = p_league_id
    and number > p_matchday_number;

  update public.leagues
  set current_matchday = p_matchday_number,
      lineups_locked = false
  where id = p_league_id;

  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (
    p_league_id,
    'matchday_opened',
    'Jornada ' || p_matchday_number || ' abierta para alineaciones.',
    jsonb_build_object('matchday_number', p_matchday_number, 'user_id', auth.uid())
  );
end;
$$;

create or replace function public.submit_lineup_by_number(
  p_league_id uuid,
  p_matchday_number integer,
  p_formation text,
  p_starters uuid[],
  p_bench uuid[] default '{}'::uuid[],
  p_captain_player_id uuid default null,
  p_starter_positions text[] default null,
  p_bench_positions text[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_league public.leagues%rowtype;
  v_matchday_id uuid;
  v_existing_lineup_id uuid;
  v_lineup_id uuid;
  v_all_players uuid[];
  v_required_count integer;
  v_owned_count integer;
  v_por integer;
  v_def integer;
  v_med integer;
  v_del integer;
  v_shape_por integer;
  v_shape_def integer;
  v_shape_med integer;
  v_shape_del integer;
  v_invalid_positions integer;
begin
  perform public.ensure_profile();

  select * into v_league
  from public.leagues
  where id = p_league_id
  for update;

  if not found then raise exception 'league_not_found'; end if;
  if not public.is_league_member(p_league_id) then raise exception 'not_member'; end if;
  if p_matchday_number < v_league.current_matchday then raise exception 'matchday_closed'; end if;
  if v_league.lineups_locked and p_matchday_number <= v_league.current_matchday then
    raise exception 'lineups_locked';
  end if;

  if p_formation = '4-4-2' then
    v_shape_por := 1; v_shape_def := 4; v_shape_med := 4; v_shape_del := 2;
  elsif p_formation = '4-3-3' then
    v_shape_por := 1; v_shape_def := 4; v_shape_med := 3; v_shape_del := 3;
  elsif p_formation = '3-5-2' then
    v_shape_por := 1; v_shape_def := 3; v_shape_med := 5; v_shape_del := 2;
  elsif p_formation = '3-4-3' then
    v_shape_por := 1; v_shape_def := 3; v_shape_med := 4; v_shape_del := 3;
  elsif p_formation = '5-3-2' then
    v_shape_por := 1; v_shape_def := 5; v_shape_med := 3; v_shape_del := 2;
  elsif p_formation = '4-5-1' then
    v_shape_por := 1; v_shape_def := 4; v_shape_med := 5; v_shape_del := 1;
  else
    raise exception 'invalid_formation';
  end if;

  if coalesce(cardinality(p_starters), 0) <> 11 then raise exception 'invalid_starters_count'; end if;
  if p_captain_player_id is not null and array_position(p_starters, p_captain_player_id) is null then
    raise exception 'captain_not_starter';
  end if;

  v_all_players := p_starters || coalesce(p_bench, '{}'::uuid[]);

  select count(*) into v_required_count
  from (select distinct player_id from unnest(v_all_players) as u(player_id)) unique_players;

  if v_required_count <> cardinality(v_all_players) then raise exception 'duplicate_lineup_player'; end if;

  select count(distinct lp.player_id) into v_owned_count
  from public.league_players lp
  where lp.league_id = p_league_id
    and lp.player_id = any(v_all_players)
    and (lp.owner_user_id = v_user_id or lp.listed_by_user_id = v_user_id);

  if v_owned_count <> v_required_count then raise exception 'player_not_owned'; end if;

  with assigned as (
    select
      s.player_id,
      coalesce(p_starter_positions[s.ordinality::integer], p.position) as assigned_position,
      case when cardinality(p.positions) > 0 then p.positions else array[p.position] end as valid_positions
    from unnest(p_starters) with ordinality as s(player_id, ordinality)
    join public.players p on p.id = s.player_id
  )
  select
    count(*) filter (where assigned_position = 'POR'),
    count(*) filter (where assigned_position = 'DEF'),
    count(*) filter (where assigned_position = 'MED'),
    count(*) filter (where assigned_position = 'DEL'),
    count(*) filter (
      where assigned_position not in ('POR', 'DEF', 'MED', 'DEL')
        or not assigned_position = any(valid_positions)
    )
  into v_por, v_def, v_med, v_del, v_invalid_positions
  from assigned;

  if v_invalid_positions > 0 then raise exception 'invalid_position_assignment'; end if;
  if v_por <> v_shape_por or v_def <> v_shape_def or v_med <> v_shape_med or v_del <> v_shape_del then
    raise exception 'invalid_formation_positions';
  end if;

  select id into v_matchday_id
  from public.matchdays
  where league_id = p_league_id and number = p_matchday_number;

  if v_matchday_id is null then
    insert into public.matchdays (league_id, number, status, starts_at)
    values (p_league_id, p_matchday_number, 'pendiente', now())
    returning id into v_matchday_id;
  end if;

  select id into v_existing_lineup_id
  from public.lineups
  where league_id = p_league_id and user_id = v_user_id and matchday_id = v_matchday_id;

  if v_existing_lineup_id is not null then raise exception 'lineup_already_submitted'; end if;

  insert into public.lineups (league_id, user_id, matchday_id, formation, status, captain_player_id)
  values (p_league_id, v_user_id, v_matchday_id, p_formation, 'submitted', p_captain_player_id)
  returning id into v_lineup_id;

  insert into public.lineup_players (lineup_id, player_id, slot, is_starter, position)
  select
    v_lineup_id,
    s.player_id,
    s.ordinality::integer - 1,
    true,
    coalesce(p_starter_positions[s.ordinality::integer], p.position)
  from unnest(p_starters) with ordinality as s(player_id, ordinality)
  join public.players p on p.id = s.player_id;

  insert into public.lineup_players (lineup_id, player_id, slot, is_starter, position)
  select
    v_lineup_id,
    b.player_id,
    10 + b.ordinality::integer,
    false,
    coalesce(p_bench_positions[b.ordinality::integer], p.position)
  from unnest(coalesce(p_bench, '{}'::uuid[])) with ordinality as b(player_id, ordinality)
  join public.players p on p.id = b.player_id;

  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (p_league_id, 'lineup', 'Alineacion guardada para J' || p_matchday_number || '.', jsonb_build_object('user_id', v_user_id, 'matchday_number', p_matchday_number));
end;
$$;

create or replace function public.set_lineup_captain(
  p_lineup_id uuid,
  p_captain_player_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lineup record;
begin
  select l.id, l.league_id, l.user_id, l.matchday_id, md.number as matchday_number, le.current_matchday, le.lineups_locked
  into v_lineup
  from public.lineups l
  join public.matchdays md on md.id = l.matchday_id
  join public.leagues le on le.id = l.league_id
  where l.id = p_lineup_id;

  if not found then
    raise exception 'lineup_not_found';
  end if;

  if v_lineup.user_id <> auth.uid() then
    raise exception 'not_lineup_owner';
  end if;

  if v_lineup.matchday_number < v_lineup.current_matchday or (v_lineup.lineups_locked and v_lineup.matchday_number <= v_lineup.current_matchday) then
    raise exception 'lineup_locked';
  end if;

  if p_captain_player_id is not null and not exists (
    select 1
    from public.lineup_players lp
    where lp.lineup_id = p_lineup_id
      and lp.player_id = p_captain_player_id
      and lp.is_starter = true
  ) then
    raise exception 'captain_not_starter';
  end if;

update public.lineups
  set captain_player_id = p_captain_player_id
  where id = p_lineup_id;
end;
$$;

update public.scoring_rules
set rules_json =
  public.default_scoring_rules()
  || coalesce(rules_json, '{}'::jsonb)
  || jsonb_build_object(
    'ballsLostEach', -1,
    'ballsRecoveredEach', 1,
    'clearancesEach', 1
  );

with derived_points as (
  select player_id, sum(points::integer)::integer as total_points
  from (
    select p.id as player_id, e.points
    from public.players p
    cross join lateral jsonb_each_text(coalesce(p.points_by_matchday, '{}'::jsonb)) as e(matchday, points)
  ) rows
  group by player_id
)
update public.players p
set total_points = derived_points.total_points
from derived_points
where p.id = derived_points.player_id
  and coalesce(p.total_points, 0) = 0
  and derived_points.total_points <> 0;

grant execute on function public.admin_update_player_availability(uuid, text, integer) to authenticated;
grant execute on function public.admin_set_current_matchday(uuid, integer) to authenticated;
grant execute on function public.submit_lineup_by_number(uuid, integer, text, uuid[], uuid[], uuid, text[], text[]) to authenticated;
grant execute on function public.set_lineup_captain(uuid, uuid) to authenticated;
