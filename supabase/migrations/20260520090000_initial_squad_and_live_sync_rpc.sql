create or replace function public.default_scoring_rules()
returns jsonb
language sql
immutable
as $$
  select '{
    "played": 1,
    "sixtyMinutes": 1,
    "goal": { "POR": 8, "DEF": 6, "MED": 5, "DEL": 4 },
    "assist": 3,
    "cleanSheet": { "POR": 4, "DEF": 3, "MED": 1 },
    "goalsConcededEveryTwo": -1,
    "yellowCard": -1,
    "redCard": -3,
    "ownGoal": -2,
    "penaltyScored": 3,
    "penaltyMissed": -2,
    "penaltySaved": 5,
    "mvp": 3,
    "teamWin": 1,
    "teamLoss": -1,
    "highlighted": 2,
    "errorLedToGoal": -2
  }'::jsonb;
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
        release_clause = round((selected.current_price * 1.8) / 50000) * 50000,
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
  values (p_name, public.generate_invite_code(), auth.uid(), p_initial_budget, p_max_members, 6)
  returning id into v_league_id;

  insert into public.league_members (league_id, user_id, role, budget)
  values (v_league_id, auth.uid(), 'admin', p_initial_budget);

  insert into public.scoring_rules (league_id, rules_json)
  values (v_league_id, coalesce(p_rules, public.default_scoring_rules()));

  insert into public.league_players (league_id, player_id, market_status, price, release_clause, market_listed_at, market_expires_at)
  select
    v_league_id,
    id,
    'locked',
    current_price,
    round((current_price * 1.8) / 50000) * 50000,
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
    match_id, player_id, minutes, goals, assists, yellow_cards, red_cards, own_goals,
    penalties_scored, penalties_missed, penalties_saved, goals_conceded, clean_sheet,
    mvp, team_won, team_lost, highlighted, error_led_to_goal, fantasy_points
  )
  select
    m.id,
    s.player_uuid,
    s.minutes,
    s.goals,
    s.assists,
    s.yellow_cards,
    s.red_cards,
    s.own_goals,
    s.penalties_scored,
    s.penalties_missed,
    s.penalties_saved,
    s.goals_conceded,
    s.clean_sheet,
    s.mvp,
    s.team_won,
    s.team_lost,
    s.highlighted,
    s.error_led_to_goal,
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
    yellow_cards integer,
    red_cards integer,
    own_goals integer,
    penalties_scored integer,
    penalties_missed integer,
    penalties_saved integer,
    goals_conceded integer,
    clean_sheet boolean,
    mvp boolean,
    team_won boolean,
    team_lost boolean,
    highlighted boolean,
    error_led_to_goal boolean,
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

  insert into public.league_members (league_id, user_id, role, budget)
  values (v_league.id, auth.uid(), 'member', v_league.initial_budget);

  perform public.assign_initial_squad(v_league.id, auth.uid());
  perform public.resolve_market_auctions(v_league.id);

  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (v_league.id, 'member_joined', 'Un nuevo manager se ha unido a la liga.', jsonb_build_object('user_id', auth.uid()));

  return v_league.id;
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
    round((p.current_price * 1.8) / 50000) * 50000
  from public.players p
  on conflict (league_id, player_id) do update
  set price = case
        when public.league_players.owner_user_id is null then excluded.price
        else public.league_players.price
      end,
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
    match_id, player_id, minutes, goals, assists, yellow_cards, red_cards, own_goals,
    penalties_scored, penalties_missed, penalties_saved, goals_conceded, clean_sheet,
    mvp, team_won, team_lost, highlighted, error_led_to_goal, fantasy_points
  )
  select
    m.id,
    s.player_uuid,
    s.minutes,
    s.goals,
    s.assists,
    s.yellow_cards,
    s.red_cards,
    s.own_goals,
    s.penalties_scored,
    s.penalties_missed,
    s.penalties_saved,
    s.goals_conceded,
    s.clean_sheet,
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
    own_goals integer,
    penalties_scored integer,
    penalties_missed integer,
    penalties_saved integer,
    goals_conceded integer,
    clean_sheet boolean,
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
      own_goals = excluded.own_goals,
      penalties_scored = excluded.penalties_scored,
      penalties_missed = excluded.penalties_missed,
      penalties_saved = excluded.penalties_saved,
      goals_conceded = excluded.goals_conceded,
      clean_sheet = excluded.clean_sheet,
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
    where l.id = lp.lineup_id and l.league_id = p_league_id and l.user_id = v_previous_owner and lp.player_id = p_player_id;
  end if;

  update public.league_players
  set owner_user_id = auth.uid(),
      market_status = 'owned',
      price = p_amount,
      release_clause = round((p_amount * 1.8) / 50000) * 50000
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

  v_amount := round((v_lp.price * 0.95) / 50000) * 50000;

  update public.league_members
  set budget = budget + v_amount
  where league_id = p_league_id and user_id = auth.uid();

  update public.league_players
  set owner_user_id = null,
      market_status = 'market',
      price = v_amount,
      release_clause = round((v_amount * 1.8) / 50000) * 50000
  where id = v_lp.id;

  delete from public.squads
  where league_id = p_league_id and user_id = auth.uid() and player_id = p_player_id;

  delete from public.lineup_players lp
  using public.lineups l
  where l.id = lp.lineup_id and l.league_id = p_league_id and l.user_id = auth.uid() and lp.player_id = p_player_id;

  insert into public.transfers (league_id, user_id, player_id, type, amount)
  values (p_league_id, auth.uid(), p_player_id, 'sell', v_amount);

  select name into v_player_name from public.players where id = p_player_id;
  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (p_league_id, 'transfer', 'Venta completada: ' || coalesce(v_player_name, 'jugador'), jsonb_build_object('user_id', auth.uid(), 'player_id', p_player_id, 'amount', v_amount));
end;
$$;

create or replace function public.raise_player_clause(p_league_id uuid, p_player_id uuid, p_new_clause numeric)
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

  if p_new_clause <= v_lp.release_clause then
    raise exception 'clause_not_higher';
  end if;

  v_cost := round(((p_new_clause - v_lp.release_clause) * 0.2) / 50000) * 50000;

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
  set release_clause = p_new_clause
  where id = v_lp.id;

  insert into public.transfers (league_id, user_id, player_id, type, amount)
  values (p_league_id, auth.uid(), p_player_id, 'clause_raise', v_cost);

  select name into v_player_name from public.players where id = p_player_id;
  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (
    p_league_id,
    'clause',
    'Cláusula actualizada: ' || coalesce(v_player_name, 'jugador'),
    jsonb_build_object('user_id', auth.uid(), 'player_id', p_player_id, 'new_clause', p_new_clause, 'cost', v_cost)
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

  v_minimum := ceil((greatest(v_lp.price, coalesce(v_highest, 0)) * 1.05) / 50000) * 50000;
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
  values (p_league_id, auth.uid(), null, p_player_id, p_amount, 'pending')
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
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    perform public.ensure_profile();
    if not public.is_league_member(p_league_id) then
      raise exception 'not_member';
    end if;
  end if;

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

      update public.league_players
      set owner_user_id = v_offer.from_user_id,
          market_status = 'owned',
          price = v_offer.amount,
          release_clause = round((v_offer.amount * 1.8) / 50000) * 50000,
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
        jsonb_build_object('user_id', v_offer.from_user_id, 'player_id', v_lp.player_id, 'amount', v_offer.amount)
      );
    else
      update public.offers
      set status = 'rejected'
      where league_id = p_league_id and player_id = v_lp.player_id and status = 'pending';

      update public.league_players
      set market_status = 'locked',
          market_listed_at = null,
          market_expires_at = null
      where id = v_lp.id;
    end if;
  end loop;

  select count(*) into v_active_count
  from public.league_players
  where league_id = p_league_id
    and owner_user_id is null
    and market_status = 'market'
    and market_expires_at > now();

  if v_active_count = 0 then
    with next_players as (
      select id
      from public.league_players
      where league_id = p_league_id
        and owner_user_id is null
        and market_status = 'locked'
      order by random()
      limit 10
    )
    update public.league_players lp
    set market_status = 'market',
        market_listed_at = now(),
        market_expires_at = now() + interval '24 hours'
    where lp.id in (select id from next_players);

    insert into public.activity_feed (league_id, type, message, metadata_json)
    values (p_league_id, 'market', 'Nuevo mercado diario abierto con 10 jugadores.', jsonb_build_object('size', 10));
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
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_league_admin(p_league_id) and not public.is_league_member(p_league_id) then
    raise exception 'not_member';
  end if;

  with lineup_scores as (
    select
      l.user_id,
      md.number,
      coalesce(sum(pms.fantasy_points), 0)::integer as points
    from public.lineups l
    join public.matchdays md on md.id = l.matchday_id
    join public.lineup_players lp on lp.lineup_id = l.id and lp.is_starter
    join public.matches m on m.matchday_id = md.id
    join public.player_match_stats pms on pms.match_id = m.id and pms.player_id = lp.player_id
    where l.league_id = p_league_id and (p_matchday_id is null or md.id = p_matchday_id)
    group by l.user_id, md.number
  ),
  totals as (
    select
      user_id,
      sum(points)::integer as total_points,
      jsonb_object_agg(number::text, points) as points_by_matchday,
      coalesce((array_agg(points order by number desc))[1], 0)::integer as last_points
    from lineup_scores
    group by user_id
  )
  update public.league_members lm
  set
    total_points = coalesce(t.total_points, 0),
    last_matchday_points = coalesce(t.last_points, 0),
    points_by_matchday = coalesce(t.points_by_matchday, '{}'::jsonb)
  from totals t
  where lm.league_id = p_league_id and lm.user_id = t.user_id;
end;
$$;

create or replace function public.calculate_points_sql(
  p_position text,
  p_minutes integer,
  p_goals integer,
  p_assists integer,
  p_yellow_cards integer,
  p_red_cards integer,
  p_own_goals integer,
  p_penalties_scored integer,
  p_penalties_missed integer,
  p_penalties_saved integer,
  p_goals_conceded integer,
  p_clean_sheet boolean,
  p_mvp boolean,
  p_team_won boolean,
  p_team_lost boolean,
  p_highlighted boolean,
  p_error_led_to_goal boolean,
  p_rules jsonb
)
returns integer
language plpgsql
immutable
as $$
declare
  v_points integer := 0;
begin
  if p_minutes > 0 then v_points := v_points + coalesce((p_rules ->> 'played')::integer, 1); end if;
  if p_minutes >= 60 then v_points := v_points + coalesce((p_rules ->> 'sixtyMinutes')::integer, 1); end if;
  v_points := v_points + p_goals * coalesce((p_rules -> 'goal' ->> p_position)::integer, 0);
  v_points := v_points + p_assists * coalesce((p_rules ->> 'assist')::integer, 3);
  if p_clean_sheet then v_points := v_points + coalesce((p_rules -> 'cleanSheet' ->> p_position)::integer, 0); end if;
  if p_position in ('POR', 'DEF') then
    v_points := v_points + floor(p_goals_conceded / 2)::integer * coalesce((p_rules ->> 'goalsConcededEveryTwo')::integer, -1);
  end if;
  v_points := v_points + p_yellow_cards * coalesce((p_rules ->> 'yellowCard')::integer, -1);
  v_points := v_points + p_red_cards * coalesce((p_rules ->> 'redCard')::integer, -3);
  v_points := v_points + p_own_goals * coalesce((p_rules ->> 'ownGoal')::integer, -2);
  v_points := v_points + p_penalties_scored * coalesce((p_rules ->> 'penaltyScored')::integer, 3);
  v_points := v_points + p_penalties_missed * coalesce((p_rules ->> 'penaltyMissed')::integer, -2);
  v_points := v_points + p_penalties_saved * coalesce((p_rules ->> 'penaltySaved')::integer, 5);
  if p_mvp then v_points := v_points + coalesce((p_rules ->> 'mvp')::integer, 3); end if;
  if p_team_won then v_points := v_points + coalesce((p_rules ->> 'teamWin')::integer, 1); end if;
  if p_team_lost then v_points := v_points + coalesce((p_rules ->> 'teamLoss')::integer, -1); end if;
  if p_highlighted then v_points := v_points + coalesce((p_rules ->> 'highlighted')::integer, 2); end if;
  if p_error_led_to_goal then v_points := v_points + coalesce((p_rules ->> 'errorLedToGoal')::integer, -2); end if;
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
        v_yellow,
        v_red,
        0,
        case when random() < 0.04 and v_goals > 0 then 1 else 0 end,
        case when random() < 0.025 then 1 else 0 end,
        case when v_player.position = 'POR' and random() < 0.025 then 1 else 0 end,
        v_gc,
        v_clean,
        false,
        v_won,
        v_lost,
        random() < 0.08,
        random() < 0.02,
        v_rules
      );

      insert into public.player_match_stats (
        match_id, player_id, minutes, goals, assists, yellow_cards, red_cards, goals_conceded,
        clean_sheet, team_won, team_lost, highlighted, error_led_to_goal, fantasy_points
      )
      values (
        v_match.id, v_player.id, v_minutes, v_goals, v_assists, v_yellow, v_red, v_gc,
        v_clean, v_won, v_lost, random() < 0.08, random() < 0.02, v_points
      );
    end loop;

    if v_mvp_player is not null then
      update public.player_match_stats pms
      set mvp = true,
          fantasy_points = fantasy_points + coalesce((v_rules ->> 'mvp')::integer, 3)
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
begin
  select md.league_id, md.id into v_league_id, v_matchday_id
  from public.matches m
  join public.matchdays md on md.id = m.matchday_id
  where m.id = p_match_id;

  if not public.is_league_admin(v_league_id) then
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
      v_points := public.calculate_points_sql(
        v_player.position,
        coalesce((v_stat ->> 'minutes')::integer, 0),
        coalesce((v_stat ->> 'goals')::integer, 0),
        coalesce((v_stat ->> 'assists')::integer, 0),
        coalesce((v_stat ->> 'yellowCards')::integer, (v_stat ->> 'yellow_cards')::integer, 0),
        coalesce((v_stat ->> 'redCards')::integer, (v_stat ->> 'red_cards')::integer, 0),
        coalesce((v_stat ->> 'ownGoals')::integer, (v_stat ->> 'own_goals')::integer, 0),
        coalesce((v_stat ->> 'penaltiesScored')::integer, (v_stat ->> 'penalties_scored')::integer, 0),
        coalesce((v_stat ->> 'penaltiesMissed')::integer, (v_stat ->> 'penalties_missed')::integer, 0),
        coalesce((v_stat ->> 'penaltiesSaved')::integer, (v_stat ->> 'penalties_saved')::integer, 0),
        coalesce((v_stat ->> 'goalsConceded')::integer, (v_stat ->> 'goals_conceded')::integer, 0),
        coalesce((v_stat ->> 'cleanSheet')::boolean, (v_stat ->> 'clean_sheet')::boolean, false),
        coalesce((v_stat ->> 'mvp')::boolean, false),
        coalesce((v_stat ->> 'teamWon')::boolean, (v_stat ->> 'team_won')::boolean, false),
        coalesce((v_stat ->> 'teamLost')::boolean, (v_stat ->> 'team_lost')::boolean, false),
        coalesce((v_stat ->> 'highlighted')::boolean, false),
        coalesce((v_stat ->> 'errorLedToGoal')::boolean, (v_stat ->> 'error_led_to_goal')::boolean, false),
        v_rules
      );

      insert into public.player_match_stats (
        match_id, player_id, minutes, goals, assists, yellow_cards, red_cards, own_goals,
        penalties_scored, penalties_missed, penalties_saved, goals_conceded, clean_sheet, mvp,
        team_won, team_lost, highlighted, error_led_to_goal, fantasy_points
      )
      values (
        p_match_id,
        v_player.id,
        coalesce((v_stat ->> 'minutes')::integer, 0),
        coalesce((v_stat ->> 'goals')::integer, 0),
        coalesce((v_stat ->> 'assists')::integer, 0),
        coalesce((v_stat ->> 'yellowCards')::integer, (v_stat ->> 'yellow_cards')::integer, 0),
        coalesce((v_stat ->> 'redCards')::integer, (v_stat ->> 'red_cards')::integer, 0),
        coalesce((v_stat ->> 'ownGoals')::integer, (v_stat ->> 'own_goals')::integer, 0),
        coalesce((v_stat ->> 'penaltiesScored')::integer, (v_stat ->> 'penalties_scored')::integer, 0),
        coalesce((v_stat ->> 'penaltiesMissed')::integer, (v_stat ->> 'penalties_missed')::integer, 0),
        coalesce((v_stat ->> 'penaltiesSaved')::integer, (v_stat ->> 'penalties_saved')::integer, 0),
        coalesce((v_stat ->> 'goalsConceded')::integer, (v_stat ->> 'goals_conceded')::integer, 0),
        coalesce((v_stat ->> 'cleanSheet')::boolean, (v_stat ->> 'clean_sheet')::boolean, false),
        coalesce((v_stat ->> 'mvp')::boolean, false),
        coalesce((v_stat ->> 'teamWon')::boolean, (v_stat ->> 'team_won')::boolean, false),
        coalesce((v_stat ->> 'teamLost')::boolean, (v_stat ->> 'team_lost')::boolean, false),
        coalesce((v_stat ->> 'highlighted')::boolean, false),
        coalesce((v_stat ->> 'errorLedToGoal')::boolean, (v_stat ->> 'error_led_to_goal')::boolean, false),
        v_points
      );
    end if;
  end loop;

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

  update public.league_members set budget = budget - v_offer.amount where league_id = v_offer.league_id and user_id = v_offer.from_user_id;
  update public.league_members set budget = budget + v_offer.amount where league_id = v_offer.league_id and user_id = auth.uid();
  update public.league_players set owner_user_id = v_offer.from_user_id, price = v_offer.amount where id = v_lp.id;

  delete from public.squads where league_id = v_offer.league_id and user_id = auth.uid() and player_id = v_offer.player_id;
  insert into public.squads (league_id, user_id, player_id, acquired_price)
  values (v_offer.league_id, v_offer.from_user_id, v_offer.player_id, v_offer.amount)
  on conflict (league_id, user_id, player_id) do update set acquired_price = excluded.acquired_price, acquired_at = now();

  update public.offers set status = 'accepted' where id = p_offer_id;
  insert into public.transfers (league_id, user_id, player_id, type, amount)
  values (v_offer.league_id, v_offer.from_user_id, v_offer.player_id, 'offer_accepted', v_offer.amount);
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
