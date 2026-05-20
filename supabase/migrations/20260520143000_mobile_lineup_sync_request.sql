create table if not exists public.challenge_sync_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references public.profiles(user_id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_challenge_sync_requests_status_created on public.challenge_sync_requests(status, created_at);

alter table public.challenge_sync_requests enable row level security;

drop policy if exists challenge_sync_requests_select_own on public.challenge_sync_requests;
create policy challenge_sync_requests_select_own on public.challenge_sync_requests
for select to authenticated
using (requested_by = auth.uid());

drop policy if exists challenge_sync_requests_insert_own on public.challenge_sync_requests;
create policy challenge_sync_requests_insert_own on public.challenge_sync_requests
for insert to authenticated
with check (requested_by = auth.uid());

drop policy if exists challenge_sync_requests_insert_public on public.challenge_sync_requests;
create policy challenge_sync_requests_insert_public on public.challenge_sync_requests
for insert to anon
with check (requested_by is null and status = 'pending');

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'challenge_sync_requests'
  ) then
    alter publication supabase_realtime add table public.challenge_sync_requests;
  end if;
end $$;

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
