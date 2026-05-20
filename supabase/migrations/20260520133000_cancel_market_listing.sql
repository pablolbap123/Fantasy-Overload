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
