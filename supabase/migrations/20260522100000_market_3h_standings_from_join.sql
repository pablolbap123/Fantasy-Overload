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

  update public.league_players
  set owner_user_id = null,
      listed_by_user_id = auth.uid(),
      market_status = 'market',
      market_listed_at = now(),
      market_expires_at = now() + interval '3 hours'
  where id = v_lp.id;

  delete from public.squads
  where league_id = p_league_id and user_id = auth.uid() and player_id = p_player_id;

  delete from public.lineup_players lp
  using public.lineups l
  where l.id = lp.lineup_id and l.league_id = p_league_id and l.user_id = auth.uid() and lp.player_id = p_player_id;

  select name into v_player_name from public.players where id = p_player_id;
  insert into public.activity_feed (league_id, type, message, metadata_json)
  values (
    p_league_id,
    'market_listing',
    'Jugador puesto en mercado: ' || coalesce(v_player_name, 'jugador'),
    jsonb_build_object('user_id', auth.uid(), 'player_id', p_player_id, 'expires_at', now() + interval '3 hours')
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

  with squad_scores as (
    select
      s.user_id,
      md.number,
      coalesce(sum(pms.fantasy_points), 0)::integer as points
    from public.squads s
    join public.league_members lm on lm.league_id = s.league_id and lm.user_id = s.user_id
    join public.matchdays md on md.league_id = s.league_id
    join public.matches m on m.matchday_id = md.id
    join public.player_match_stats pms on pms.match_id = m.id and pms.player_id = s.player_id
    where s.league_id = p_league_id
      and (p_matchday_id is null or md.id = p_matchday_id)
      and coalesce(m.played_at, md.starts_at, now()) >= lm.created_at
      and coalesce(m.played_at, md.starts_at, now()) >= s.acquired_at
    group by s.user_id, md.number
  ),
  latest_matchday as (
    select md.number
    from public.matchdays md
    where md.league_id = p_league_id
      and (p_matchday_id is null or md.id = p_matchday_id)
    order by md.number desc
    limit 1
  ),
  totals as (
    select
      user_id,
      sum(points)::integer as total_points,
      jsonb_object_agg(number::text, points) as points_by_matchday,
      coalesce(sum(points) filter (where number = (select number from latest_matchday)), 0)::integer as last_points
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
end;
$$;

update public.league_players
set market_expires_at = now() + interval '3 hours'
where market_status = 'market'
  and market_expires_at is not null
  and market_expires_at > now() + interval '3 hours';

select set_config('request.jwt.claim.role', 'service_role', true);
select public.resolve_all_market_auctions();
select public.recalculate_league_points(id, null::uuid) from public.leagues;
