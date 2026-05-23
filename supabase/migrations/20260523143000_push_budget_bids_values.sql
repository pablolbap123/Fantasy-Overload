create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  token text not null unique,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_events (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  type text not null check (type in ('matchday_bonus', 'manual', 'correction')),
  matchday_number integer,
  amount numeric not null default 0 check (amount >= 0),
  description text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_events_unique_scope unique (league_id, user_id, type, matchday_number)
);

alter table public.push_subscriptions enable row level security;
alter table public.budget_events enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions
for select to authenticated
using (user_id = auth.uid());

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own on public.push_subscriptions
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions
for delete to authenticated
using (user_id = auth.uid());

drop policy if exists budget_events_select_own on public.budget_events;
create policy budget_events_select_own on public.budget_events
for select to authenticated
using (user_id = auth.uid() and public.is_league_member(league_id));

create or replace function public.apply_player_paid_value(
  p_player_id uuid,
  p_paid_amount numeric,
  p_anchor_matchday integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric;
  v_anchor_matchday integer;
begin
  v_amount := round(greatest(coalesce(p_paid_amount, 0), 0) / 50000) * 50000;
  if v_amount <= 0 then
    raise exception 'invalid_paid_value';
  end if;

  select coalesce(
    p_anchor_matchday,
    (
      select max(entry.key::integer)
      from public.players p
      cross join lateral jsonb_each_text(coalesce(p.points_by_matchday, '{}'::jsonb)) as entry(key, value)
      where p.id = p_player_id and entry.key ~ '^[0-9]+$'
    ),
    0
  )
  into v_anchor_matchday;

  update public.players
  set
    current_price = v_amount,
    stats_json = coalesce(stats_json, '{}'::jsonb)
      || jsonb_build_object(
        'marketAnchorPrice', v_amount,
        'marketAnchorMatchday', v_anchor_matchday,
        'marketAnchorAt', now(),
        'priceHistory', coalesce(stats_json -> 'priceHistory', '{}'::jsonb) || jsonb_build_object(v_anchor_matchday::text, v_amount)
      )
  where id = p_player_id;

  if not found then
    raise exception 'player_not_found';
  end if;

  update public.league_players
  set
    price = v_amount,
    release_clause = greatest(coalesce(release_clause, 0), public.default_release_clause(v_amount))
  where player_id = p_player_id;
end;
$$;

create or replace function public.recalculate_player_market_values()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with anchors as (
    select
      p.id,
      p.base_price,
      case
        when coalesce(p.stats_json ->> 'marketAnchorPrice', '') ~ '^[0-9]+(\.[0-9]+)?$'
        then (p.stats_json ->> 'marketAnchorPrice')::numeric
        else p.base_price
      end as anchor_price,
      case
        when coalesce(p.stats_json ->> 'marketAnchorMatchday', '') ~ '^[0-9]+$'
        then (p.stats_json ->> 'marketAnchorMatchday')::integer
        else 0
      end as anchor_matchday
    from public.players p
  ),
  point_rows as (
    select
      a.id,
      a.anchor_price,
      entry.key::integer as number,
      entry.value::numeric as points
    from anchors a
    join public.players p on p.id = a.id
    cross join lateral jsonb_each_text(coalesce(p.points_by_matchday, '{}'::jsonb)) as entry(key, value)
    where entry.key ~ '^[0-9]+$' and entry.key::integer > a.anchor_matchday
  ),
  cumulative as (
    select
      id,
      number,
      round((greatest(500000, least(250000000, anchor_price + sum(points) over (partition by id order by number) * 250000 + points * 150000))) / 50000) * 50000 as market_value
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
    current_price = coalesce(
      latest.market_value,
      round((greatest(500000, least(250000000, anchors.anchor_price))) / 50000) * 50000
    ),
    stats_json = coalesce(p.stats_json, '{}'::jsonb) || jsonb_build_object('priceHistory', coalesce(histories.price_history, '{}'::jsonb))
  from anchors
  left join histories on histories.id = anchors.id
  left join latest on latest.id = anchors.id
  where p.id = anchors.id;

  update public.league_players lp
  set
    price = p.current_price,
    release_clause = greatest(coalesce(lp.release_clause, 0), public.default_release_clause(p.current_price))
  from public.players p
  where p.id = lp.player_id;
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
      and exists (
        select 1
        from public.matches m
        join public.player_match_stats pms on pms.match_id = m.id
        where m.matchday_id = md.id
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

  with squad_scores as (
    select
      lp.owner_user_id as user_id,
      md.number,
      coalesce(sum(
        case
          when p.status in ('lesionado', 'sancionado')
            and (p.unavailable_until_matchday is null or md.number <= p.unavailable_until_matchday)
          then 0
          else pms.fantasy_points
        end
      ), 0)::integer as points
    from public.league_players lp
    join public.league_members lm on lm.league_id = lp.league_id and lm.user_id = lp.owner_user_id
    join public.players p on p.id = lp.player_id
    join public.matchdays md on md.league_id = lp.league_id
    join public.matches m on m.matchday_id = md.id
    join public.player_match_stats pms on pms.match_id = m.id and pms.player_id = lp.player_id
    where lp.league_id = p_league_id
      and lp.owner_user_id is not null
      and md.number >= coalesce(lm.joined_matchday, 1)
      and (p_matchday_id is null or md.id = p_matchday_id)
    group by lp.owner_user_id, md.number
  ),
  totals as (
    select
      user_id,
      sum(points)::integer as total_points,
      jsonb_object_agg(number::text, points) as points_by_matchday,
      coalesce((array_agg(points order by number desc))[1], 0)::integer as last_points
    from squad_scores
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

create or replace function public.cancel_offer(p_offer_id uuid)
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
    and from_user_id = auth.uid();

  if not found then
    raise exception 'offer_not_found_or_forbidden';
  end if;
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
    where l.id = lp.lineup_id and l.league_id = p_league_id and l.user_id = v_previous_owner and lp.player_id = p_player_id;
  end if;

  update public.league_players
  set owner_user_id = auth.uid(),
      listed_by_user_id = null,
      market_status = 'owned',
      price = p_amount,
      release_clause = public.default_release_clause(p_amount),
      clause_locked_until = now() + interval '5 days'
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

        update public.league_players
        set listed_by_user_id = null,
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

    insert into public.activity_feed (league_id, type, message, metadata_json)
    values (p_league_id, 'market', 'Mercado rotativo actualizado con hasta 20 jugadores.', jsonb_build_object('size', 20, 'duration_hours', 3));
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

  v_paid_value := greatest(v_offer.amount, v_lp.price);

  update public.league_members set budget = budget - v_offer.amount where league_id = v_offer.league_id and user_id = v_offer.from_user_id;
  update public.league_members set budget = budget + v_offer.amount where league_id = v_offer.league_id and user_id = auth.uid();
  update public.league_players
  set owner_user_id = v_offer.from_user_id,
      listed_by_user_id = null,
      price = v_paid_value,
      release_clause = public.default_release_clause(v_paid_value),
      clause_locked_until = now() + interval '5 days'
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
        release_clause = public.default_release_clause(price),
        clause_locked_until = now() + interval '5 days'
    where id = v_exchange_lp.id;

    delete from public.squads where league_id = v_offer.league_id and user_id = v_offer.from_user_id and player_id = v_offer.exchange_player_id;
    insert into public.squads (league_id, user_id, player_id, acquired_price)
    values (v_offer.league_id, auth.uid(), v_offer.exchange_player_id, v_exchange_lp.price)
    on conflict (league_id, user_id, player_id) do update set acquired_price = excluded.acquired_price, acquired_at = now();

    delete from public.lineup_players lp
    using public.lineups l
    where l.id = lp.lineup_id and l.league_id = v_offer.league_id and l.user_id = v_offer.from_user_id and lp.player_id = v_offer.exchange_player_id;

    insert into public.transfers (league_id, user_id, player_id, type, amount)
    values (v_offer.league_id, auth.uid(), v_offer.exchange_player_id, 'offer_accepted', v_exchange_lp.price);
  end if;

  delete from public.lineup_players lp
  using public.lineups l
  where l.id = lp.lineup_id and l.league_id = v_offer.league_id and l.user_id = auth.uid() and lp.player_id = v_offer.player_id;

  update public.offers set status = 'accepted' where id = p_offer_id;
  insert into public.transfers (league_id, user_id, player_id, type, amount)
  values (v_offer.league_id, v_offer.from_user_id, v_offer.player_id, 'offer_accepted', v_paid_value);
end;
$$;
