alter table public.players
  add column if not exists unavailable_until_matchday integer;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
for select
using (bucket_id = 'avatars');

drop policy if exists avatars_user_insert on storage.objects;
create policy avatars_user_insert on storage.objects
for insert
with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists avatars_user_update on storage.objects;
create policy avatars_user_update on storage.objects
for update
using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

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
begin
  if not public.is_overload_admin() then
    raise exception 'overload_admin_required';
  end if;
  if p_matchday_number < 1 then
    raise exception 'invalid_matchday';
  end if;

  update public.leagues
  set current_matchday = p_matchday_number
  where id = p_league_id;

  if not found then
    raise exception 'league_not_found';
  end if;
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
  v_matchday_number integer;
  v_blocked text;
begin
  perform public.ensure_profile();

  if exists (select 1 from public.leagues where id = p_league_id and lineups_locked) then
    raise exception 'lineups_locked';
  end if;

  if not exists (select 1 from public.league_members where league_id = p_league_id and user_id = auth.uid()) then
    raise exception 'not_member';
  end if;

  select number into v_matchday_number
  from public.matchdays
  where id = p_matchday_id and league_id = p_league_id;

  if not found then
    raise exception 'matchday_not_found';
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

  select string_agg(p.name, ', ') into v_blocked
  from unnest(p_starters) as selected(player_id)
  join public.players p on p.id = selected.player_id
  where p.status in ('lesionado', 'sancionado')
    and (p.unavailable_until_matchday is null or v_matchday_number <= p.unavailable_until_matchday);

  if v_blocked is not null then
    raise exception 'lineup_contains_unavailable_players: %', v_blocked;
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
  values (p_league_id, 'lineup', 'Alineacion guardada para la jornada.', jsonb_build_object('user_id', auth.uid(), 'matchday_id', p_matchday_id));

  return v_lineup_id;
end;
$$;

create or replace function public.submit_lineup_by_number(
  p_league_id uuid,
  p_matchday_number integer,
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
  v_matchday_id uuid;
  v_missing integer;
  v_current integer;
  v_locked boolean;
  v_blocked text;
begin
  perform public.ensure_profile();

  if p_matchday_number is null or p_matchday_number < 1 then
    raise exception 'invalid_matchday';
  end if;

  select current_matchday, lineups_locked
  into v_current, v_locked
  from public.leagues
  where id = p_league_id;

  if not found then
    raise exception 'league_not_found';
  end if;

  if v_locked and p_matchday_number <= v_current then
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

  select string_agg(p.name, ', ') into v_blocked
  from unnest(p_starters) as selected(player_id)
  join public.players p on p.id = selected.player_id
  where p.status in ('lesionado', 'sancionado')
    and (p.unavailable_until_matchday is null or p_matchday_number <= p.unavailable_until_matchday);

  if v_blocked is not null then
    raise exception 'lineup_contains_unavailable_players: %', v_blocked;
  end if;

  insert into public.matchdays (league_id, number, status, starts_at)
  values (p_league_id, p_matchday_number, 'pendiente', now())
  on conflict (league_id, number) do update
  set status = public.matchdays.status
  returning id into v_matchday_id;

  insert into public.lineups (league_id, user_id, matchday_id, formation, status)
  values (p_league_id, auth.uid(), v_matchday_id, p_formation, 'submitted')
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
  values (
    p_league_id,
    'lineup',
    'Alineacion subida para la jornada ' || p_matchday_number || '.',
    jsonb_build_object('user_id', auth.uid(), 'matchday_number', p_matchday_number, 'matchday_id', v_matchday_id)
  );

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
    join public.players p on p.id = lp.player_id
    join public.matchdays md on md.league_id = lp.league_id
    join public.matches m on m.matchday_id = md.id
    join public.player_match_stats pms on pms.match_id = m.id and pms.player_id = lp.player_id
    where lp.league_id = p_league_id
      and lp.owner_user_id is not null
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
end;
$$;
