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

create or replace function public.set_league_member_joined_matchday()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.joined_matchday is null or new.joined_matchday < 1 then
    new.joined_matchday := public.default_joined_matchday(new.league_id);
  end if;
  return new;
end;
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
  where not exists (select 1 from public.players p2, jsonb_each_text(coalesce(p2.points_by_matchday, '{}'::jsonb)) e where p2.id = p.id);

  update public.league_players lp
  set
    price = p.current_price,
    release_clause = greatest(coalesce(lp.release_clause, 0), public.default_release_clause(p.current_price))
  from public.players p
  where p.id = lp.player_id;
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
  select v_league_id, id, 'locked', current_price, public.default_release_clause(current_price), null, null
  from public.players;

  perform public.assign_initial_squad(v_league_id, auth.uid());
  perform public.sync_league_from_official(v_league_id);
  perform public.resolve_market_auctions(v_league_id);

  update public.leagues
  set current_matchday = public.default_joined_matchday(v_league_id)
  where id = v_league_id;

  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (v_league_id, 'league_created', 'Liga creada. Comparte el codigo de invitacion para empezar.', jsonb_build_object('owner_id', auth.uid()));

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

drop function if exists public.raise_player_clause(uuid, uuid, numeric);

create function public.raise_player_clause(p_league_id uuid, p_player_id uuid, p_spend_amount numeric)
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
    'Clausula actualizada: ' || coalesce(v_player_name, 'jugador'),
    jsonb_build_object('user_id', auth.uid(), 'player_id', p_player_id, 'new_clause', v_new_clause, 'cost', v_cost, 'increase', v_cost * 3)
  );
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

select public.recalculate_player_market_values();

update public.leagues
set
  current_matchday = coalesce((select max(number) + 1 from public.official_matchdays), 8),
  max_members = greatest(max_members, 50);

update public.league_members lm
set joined_matchday = public.default_joined_matchday(lm.league_id);

select set_config('request.jwt.claim.role', 'service_role', true);
select public.recalculate_league_points(id, null::uuid) from public.leagues;
