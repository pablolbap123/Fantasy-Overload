alter table public.league_members
add column if not exists joined_matchday integer;

create or replace function public.default_joined_matchday(p_league_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select greatest(
    coalesce((select current_matchday from public.leagues where id = p_league_id), 1),
    coalesce((select max(number) from public.official_matchdays), 0)
  ) + 1;
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

drop trigger if exists set_league_member_joined_matchday_trigger on public.league_members;
create trigger set_league_member_joined_matchday_trigger
before insert on public.league_members
for each row
execute function public.set_league_member_joined_matchday();

update public.league_members lm
set joined_matchday = public.default_joined_matchday(lm.league_id)
where lm.joined_matchday is null or lm.joined_matchday <= 1;

alter table public.league_members
alter column joined_matchday set not null;

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
      and md.number >= coalesce(lm.joined_matchday, 1)
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

select set_config('request.jwt.claim.role', 'service_role', true);
select public.recalculate_league_points(id, null::uuid) from public.leagues;
