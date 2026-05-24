alter table public.players
  add column if not exists positions text[];

update public.players
set positions = array[position]
where positions is null or cardinality(positions) = 0;

alter table public.players
  alter column positions set default array['MED']::text[],
  alter column positions set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'players_positions_valid'
      and conrelid = 'public.players'::regclass
  ) then
    alter table public.players
      add constraint players_positions_valid
      check (cardinality(positions) > 0 and positions <@ array['POR', 'DEF', 'MED', 'DEL']::text[]);
  end if;
end $$;

alter table public.lineups
  add column if not exists captain_player_id uuid references public.players(id) on delete set null;

drop function if exists public.submit_lineup_by_number(uuid, integer, text, uuid[], uuid[]);
drop function if exists public.submit_lineup_by_number(uuid, integer, text, uuid[], uuid[], uuid);
drop function if exists public.submit_lineup_by_number(uuid, integer, text, uuid[], uuid[], uuid, text[], text[]);

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
end;
$$;

drop function if exists public.submit_lineup(uuid, text, uuid[], uuid[]);
drop function if exists public.submit_lineup(uuid, text, uuid[], uuid[], uuid);
drop function if exists public.submit_lineup(uuid, text, uuid[], uuid[], uuid, text[], text[]);

create or replace function public.submit_lineup(
  p_matchday_id uuid,
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
  v_league_id uuid;
  v_matchday_number integer;
begin
  select league_id, number into v_league_id, v_matchday_number
  from public.matchdays
  where id = p_matchday_id;

  if v_league_id is null then raise exception 'matchday_not_found'; end if;

  perform public.submit_lineup_by_number(
    v_league_id,
    v_matchday_number,
    p_formation,
    p_starters,
    p_bench,
    p_captain_player_id,
    p_starter_positions,
    p_bench_positions
  );
end;
$$;

create or replace function public.award_matchday_budget(p_league_id uuid, p_matchday_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with matchday_scope as (
    select md.id, md.number
    from public.matchdays md
    where md.league_id = p_league_id
      and (p_matchday_id is null or md.id = p_matchday_id)
      and (
        select count(*)
        from public.matches m
        where m.matchday_id = md.id
      ) >= 14
      and not exists (
        select 1
        from public.matches m
        where m.matchday_id = md.id
          and (m.status <> 'finalizada' or m.home_score is null or m.away_score is null)
      )
  ),
  scores as (
    select
      lm.league_id,
      lm.user_id,
      md.number,
      coalesce((lm.points_by_matchday ->> md.number::text)::numeric, 0) as points
    from public.league_members lm
    join matchday_scope md on true
    where lm.league_id = p_league_id
      and md.number >= coalesce(lm.joined_matchday, 1)
  ),
  ranked as (
    select
      scores.*,
      dense_rank() over (partition by league_id, number order by points desc) as matchday_rank
    from scores
  ),
  target as (
    select
      league_id,
      user_id,
      'matchday_bonus'::text as type,
      number as matchday_number,
      round((
        greatest(points, 0) * 100000
        + case
          when points > 0 and matchday_rank = 1 then 3000000
          when points > 0 and matchday_rank = 2 then 1500000
          when points > 0 and matchday_rank = 3 then 750000
          else 0
        end
      ) / 50000) * 50000 as amount,
      'J' || number || ': ' || points || ' puntos, puesto ' || matchday_rank as description,
      jsonb_build_object('points', points, 'rank', matchday_rank, 'points_rate', 100000) as metadata_json
    from ranked
  ),
  deltas as (
    select
      target.*,
      target.amount - coalesce(be.amount, 0) as delta
    from target
    left join public.budget_events be
      on be.league_id = target.league_id
      and be.user_id = target.user_id
      and be.type = target.type
      and be.matchday_number = target.matchday_number
    where target.amount > 0 or be.id is not null
  ),
  upserted as (
    insert into public.budget_events (league_id, user_id, type, matchday_number, amount, description, metadata_json)
    select league_id, user_id, type, matchday_number, amount, description, metadata_json
    from deltas
    on conflict on constraint budget_events_unique_scope
    do update set
      amount = excluded.amount,
      description = excluded.description,
      metadata_json = excluded.metadata_json,
      updated_at = now()
    returning id
  ),
  member_deltas as (
    select user_id, sum(delta) as total_delta
    from deltas
    where delta <> 0
    group by user_id
  )
  update public.league_members lm
  set budget = greatest(0, lm.budget + member_deltas.total_delta)
  from member_deltas
  where lm.league_id = p_league_id and lm.user_id = member_deltas.user_id;
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
      and md.number >= coalesce(lm.joined_matchday, 1)
    group by l.user_id, md.number
  ),
  totals as (
    select
      user_id,
      sum(points)::integer as total_points,
      jsonb_object_agg(number::text, points order by number) as points_by_matchday,
      coalesce((array_agg(points order by number desc))[1], 0)::integer as last_points
    from lineup_scores
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

  perform public.award_matchday_budget(p_league_id, p_matchday_id);
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

  if not found or v_lp.owner_user_id <> auth.uid() then raise exception 'not_player_owner'; end if;
  if v_lp.market_status = 'market' and v_lp.listed_by_user_id = auth.uid() then raise exception 'already_listed'; end if;

  update public.league_players
  set listed_by_user_id = auth.uid(),
      market_status = 'market',
      market_listed_at = now(),
      market_expires_at = now() + interval '3 hours'
  where id = v_lp.id;

  select name into v_player_name from public.players where id = p_player_id;
  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (
    p_league_id,
    'market_listing',
    coalesce(v_player_name, 'Jugador') || ' sale al mercado durante 3 horas.',
    jsonb_build_object('user_id', auth.uid(), 'player_id', p_player_id, 'duration_hours', 3)
  );
end;
$$;

create or replace function public.cancel_market_listing(p_league_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.league_players
  set listed_by_user_id = null,
      owner_user_id = auth.uid(),
      market_status = 'owned',
      market_listed_at = null,
      market_expires_at = null
  where league_id = p_league_id
    and player_id = p_player_id
    and listed_by_user_id = auth.uid();

  if not found then raise exception 'listing_not_found'; end if;

  update public.offers
  set status = 'rejected'
  where league_id = p_league_id
    and player_id = p_player_id
    and status = 'pending';
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

  if not found
    or v_lp.market_status <> 'market'
    or (v_lp.owner_user_id is not null and v_lp.listed_by_user_id is null)
  then
    raise exception 'player_not_in_daily_market';
  end if;

  if v_lp.listed_by_user_id = auth.uid() then raise exception 'cannot_bid_own_listing'; end if;
  if v_lp.market_expires_at is null or v_lp.market_expires_at <= now() then raise exception 'auction_finished'; end if;

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
  if p_amount < v_minimum then raise exception 'bid_too_low'; end if;

  update public.offers
  set status = 'outbid'
  where league_id = p_league_id
    and player_id = p_player_id
    and status = 'pending'
    and amount < p_amount;

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
  if v_lp.owner_user_id is not null and v_lp.listed_by_user_id is not null then raise exception 'player_in_auction'; end if;
  if v_lp.owner_user_id is not null and v_lp.clause_locked_until is not null and v_lp.clause_locked_until > now() then
    raise exception 'clause_locked_until_%', v_lp.clause_locked_until;
  end if;
  if v_lp.owner_user_id is not null and p_amount < v_lp.release_clause then raise exception 'amount_below_clause'; end if;
  if v_member.budget < p_amount then raise exception 'not_enough_budget'; end if;

  v_previous_owner := v_lp.owner_user_id;
  v_transfer_type := case when v_previous_owner is null then 'buy' else 'clause_buy' end;

  update public.league_members set budget = budget - p_amount where id = v_member.id;

  if v_previous_owner is not null then
    update public.league_members
    set budget = budget + p_amount
    where league_id = p_league_id and user_id = v_previous_owner;

    delete from public.squads
    where league_id = p_league_id and user_id = v_previous_owner and player_id = p_player_id;
  end if;

  update public.league_players
  set owner_user_id = auth.uid(),
      listed_by_user_id = null,
      market_status = 'owned',
      price = p_amount,
      release_clause = public.default_release_clause(p_amount),
      clause_locked_until = now() + interval '5 days',
      market_listed_at = null,
      market_expires_at = null
  where id = v_lp.id;

  perform public.apply_player_paid_value(p_player_id, p_amount, null);

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
      else 'Clausula pagada: ' || coalesce(v_player_name, 'jugador')
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

  select * into v_lp
  from public.league_players
  where league_id = p_league_id and player_id = p_player_id
  for update;

  if not found or v_lp.owner_user_id <> auth.uid() then raise exception 'not_player_owner'; end if;

  v_amount := round((v_lp.price * 0.5) / 50000) * 50000;

  update public.league_members
  set budget = budget + v_amount
  where league_id = p_league_id and user_id = auth.uid();

  delete from public.squads
  where league_id = p_league_id and user_id = auth.uid() and player_id = p_player_id;

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

  insert into public.transfers (league_id, user_id, player_id, type, amount)
  values (p_league_id, auth.uid(), p_player_id, 'sell', v_amount);

  select name into v_player_name from public.players where id = p_player_id;
  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (
    p_league_id,
    'transfer',
    'Venta rapida: ' || coalesce(v_player_name, 'jugador'),
    jsonb_build_object('user_id', auth.uid(), 'player_id', p_player_id, 'amount', v_amount)
  );
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
    if not public.is_league_member(p_league_id) then raise exception 'not_member'; end if;
  end if;

  for v_lp in
    select *
    from public.league_players
    where league_id = p_league_id
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

        delete from public.squads
        where league_id = p_league_id and user_id = v_lp.listed_by_user_id and player_id = v_lp.player_id;
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

      perform public.apply_player_paid_value(v_lp.player_id, v_offer.amount, null);

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

        delete from public.squads
        where league_id = p_league_id and user_id = v_lp.listed_by_user_id and player_id = v_lp.player_id;

        update public.league_players
        set owner_user_id = null,
            listed_by_user_id = null,
            market_status = 'locked',
            price = v_league_offer,
            release_clause = public.default_release_clause(v_league_offer),
            clause_locked_until = null,
            market_listed_at = null,
            market_expires_at = null
        where id = v_lp.id;

        perform public.apply_player_paid_value(v_lp.player_id, v_league_offer, null);

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

  select count(*) into v_active_count
  from public.league_players
  where league_id = p_league_id
    and owner_user_id is null
    and listed_by_user_id is null
    and market_status = 'market'
    and market_expires_at > now();

  if v_active_count < 20 then
    with next_players as (
      select id
      from public.league_players
      where league_id = p_league_id
        and owner_user_id is null
        and listed_by_user_id is null
        and market_status = 'locked'
      order by random()
      limit greatest(0, 20 - v_active_count)
    )
    update public.league_players lp
    set market_status = 'market',
        listed_by_user_id = null,
        market_listed_at = now(),
        market_expires_at = now() + interval '3 hours'
    where lp.id in (select id from next_players);
  end if;
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
  v_paid_value numeric;
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

  if not found then raise exception 'buyer_not_member'; end if;
  if v_buyer.budget < v_offer.amount then raise exception 'buyer_not_enough_budget'; end if;

  if v_offer.kind = 'exchange' then
    if v_offer.exchange_player_id is null then raise exception 'exchange_player_required'; end if;

    select * into v_exchange_lp
    from public.league_players
    where league_id = v_offer.league_id and player_id = v_offer.exchange_player_id
    for update;

    if not found or v_exchange_lp.owner_user_id <> v_offer.from_user_id then
      raise exception 'exchange_player_not_owned';
    end if;
  end if;

  v_paid_value := greatest(v_offer.amount, v_lp.price);

  update public.league_members set budget = budget - v_offer.amount where league_id = v_offer.league_id and user_id = v_offer.from_user_id;
  update public.league_members set budget = budget + v_offer.amount where league_id = v_offer.league_id and user_id = auth.uid();

  update public.league_players
  set owner_user_id = v_offer.from_user_id,
      listed_by_user_id = null,
      market_status = 'owned',
      price = v_paid_value,
      release_clause = public.default_release_clause(v_paid_value),
      clause_locked_until = now() + interval '5 days',
      market_listed_at = null,
      market_expires_at = null
  where id = v_lp.id;

  perform public.apply_player_paid_value(v_offer.player_id, v_paid_value, null);

  delete from public.squads where league_id = v_offer.league_id and user_id = auth.uid() and player_id = v_offer.player_id;
  insert into public.squads (league_id, user_id, player_id, acquired_price)
  values (v_offer.league_id, v_offer.from_user_id, v_offer.player_id, v_paid_value)
  on conflict (league_id, user_id, player_id) do update set acquired_price = excluded.acquired_price, acquired_at = now();

  if v_offer.kind = 'exchange' then
    update public.league_players
    set owner_user_id = auth.uid(),
        listed_by_user_id = null,
        market_status = 'owned',
        release_clause = public.default_release_clause(price),
        clause_locked_until = now() + interval '5 days',
        market_listed_at = null,
        market_expires_at = null
    where id = v_exchange_lp.id;

    delete from public.squads where league_id = v_offer.league_id and user_id = v_offer.from_user_id and player_id = v_offer.exchange_player_id;
    insert into public.squads (league_id, user_id, player_id, acquired_price)
    values (v_offer.league_id, auth.uid(), v_offer.exchange_player_id, v_exchange_lp.price)
    on conflict (league_id, user_id, player_id) do update set acquired_price = excluded.acquired_price, acquired_at = now();

    insert into public.transfers (league_id, user_id, player_id, type, amount)
    values (v_offer.league_id, auth.uid(), v_offer.exchange_player_id, 'offer_accepted', v_exchange_lp.price);
  end if;

  update public.offers set status = 'accepted' where id = p_offer_id;
  insert into public.transfers (league_id, user_id, player_id, type, amount)
  values (v_offer.league_id, v_offer.from_user_id, v_offer.player_id, 'offer_accepted', v_paid_value);
end;
$$;
