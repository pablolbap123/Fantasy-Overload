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

  insert into public.matchdays (league_id, number, status, starts_at)
  values (p_league_id, p_matchday_number, 'pendiente', now())
  on conflict (league_id, number) do nothing;

  update public.leagues
  set current_matchday = p_matchday_number
  where id = p_league_id;

  if not found then
    raise exception 'league_not_found';
  end if;
end;
$$;

insert into public.matchdays (league_id, number, status, starts_at)
select
  l.id,
  matchday_number,
  'pendiente',
  now() + ((matchday_number - greatest(l.current_matchday, 1)) * interval '7 days')
from public.leagues l
cross join generate_series(1, 13) as generated(matchday_number)
on conflict (league_id, number) do nothing;
