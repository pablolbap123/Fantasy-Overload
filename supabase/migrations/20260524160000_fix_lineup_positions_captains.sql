do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lineup_players'
      and column_name = 'position'
      and data_type = 'ARRAY'
  ) then
    alter table public.lineup_players drop constraint if exists lineup_players_position_check;
    execute 'alter table public.lineup_players alter column position type text using coalesce(position[1], ''MED'')';
    alter table public.lineup_players alter column position set not null;
    alter table public.lineup_players
      add constraint lineup_players_position_check
      check (position in ('POR', 'DEF', 'MED', 'DEL'));
  end if;
end $$;

create or replace function public.set_lineup_captain(
  p_lineup_id uuid,
  p_captain_player_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lineup record;
begin
  select l.id, l.league_id, l.user_id, l.matchday_id, md.number as matchday_number, le.current_matchday, le.lineups_locked
  into v_lineup
  from public.lineups l
  join public.matchdays md on md.id = l.matchday_id
  join public.leagues le on le.id = l.league_id
  where l.id = p_lineup_id;

  if not found then
    raise exception 'lineup_not_found';
  end if;

  if v_lineup.user_id <> auth.uid() then
    raise exception 'not_lineup_owner';
  end if;

  if v_lineup.lineups_locked and v_lineup.matchday_number <= v_lineup.current_matchday then
    raise exception 'lineup_locked';
  end if;

  if p_captain_player_id is not null and not exists (
    select 1
    from public.lineup_players lp
    where lp.lineup_id = p_lineup_id
      and lp.player_id = p_captain_player_id
      and lp.is_starter = true
  ) then
    raise exception 'captain_not_starter';
  end if;

  update public.lineups
  set captain_player_id = p_captain_player_id
  where id = p_lineup_id;
end;
$$;

grant execute on function public.set_lineup_captain(uuid, uuid) to authenticated;

do $$
declare
  v_lineup record;
  v_position text;
  v_need int;
  v_current int;
  v_missing int;
  v_next_slot int;
  v_player_id uuid;
  v_fixed int := 0;
begin
  for v_lineup in
    select l.id, l.league_id, l.user_id, l.formation
    from public.lineups l
    where (
      select count(*)
      from public.lineup_players lp
      where lp.lineup_id = l.id
        and lp.is_starter = true
    ) < 11
  loop
    foreach v_position in array array['POR', 'DEF', 'MED', 'DEL'] loop
      v_need := case v_lineup.formation
        when '4-4-2' then case v_position when 'POR' then 1 when 'DEF' then 4 when 'MED' then 4 when 'DEL' then 2 else 0 end
        when '4-3-3' then case v_position when 'POR' then 1 when 'DEF' then 4 when 'MED' then 3 when 'DEL' then 3 else 0 end
        when '3-5-2' then case v_position when 'POR' then 1 when 'DEF' then 3 when 'MED' then 5 when 'DEL' then 2 else 0 end
        when '3-4-3' then case v_position when 'POR' then 1 when 'DEF' then 3 when 'MED' then 4 when 'DEL' then 3 else 0 end
        when '5-3-2' then case v_position when 'POR' then 1 when 'DEF' then 5 when 'MED' then 3 when 'DEL' then 2 else 0 end
        when '4-5-1' then case v_position when 'POR' then 1 when 'DEF' then 4 when 'MED' then 5 when 'DEL' then 1 else 0 end
        else 0
      end;

      select count(*) into v_current
      from public.lineup_players lp
      where lp.lineup_id = v_lineup.id
        and lp.is_starter = true
        and lp.position = v_position;

      v_missing := greatest(0, v_need - v_current);

      while v_missing > 0 loop
        select slot into v_next_slot
        from generate_series(0, 10) as slots(slot)
        where not exists (
          select 1
          from public.lineup_players lp
          where lp.lineup_id = v_lineup.id
            and lp.is_starter = true
            and lp.slot = slots.slot
        )
        order by slot
        limit 1;

        if v_next_slot is null then
          v_next_slot := (
            select coalesce(max(slot) + 1, 0)
            from public.lineup_players
            where lineup_id = v_lineup.id
          );
        end if;

        v_player_id := null;
        select lp.player_id into v_player_id
        from public.lineup_players lp
        join public.players p on p.id = lp.player_id
        where lp.lineup_id = v_lineup.id
          and lp.is_starter = false
          and coalesce(p.positions, array[p.position]) @> array[v_position]::text[]
          and not exists (
            select 1
            from public.lineup_players existing
            where existing.lineup_id = v_lineup.id
              and existing.player_id = lp.player_id
              and existing.is_starter = true
          )
        order by lp.slot
        limit 1;

        if v_player_id is not null then
          update public.lineup_players
          set is_starter = true,
              slot = v_next_slot,
              position = v_position
          where lineup_id = v_lineup.id
            and player_id = v_player_id;
        else
          select lpx.player_id into v_player_id
          from public.league_players lpx
          join public.players p on p.id = lpx.player_id
          where lpx.league_id = v_lineup.league_id
            and (lpx.owner_user_id = v_lineup.user_id or lpx.listed_by_user_id = v_lineup.user_id)
            and coalesce(p.positions, array[p.position]) @> array[v_position]::text[]
            and not exists (
              select 1
              from public.lineup_players existing
              where existing.lineup_id = v_lineup.id
                and existing.player_id = lpx.player_id
            )
          order by p.total_points desc nulls last, p.current_price desc nulls last, p.name
          limit 1;

          if v_player_id is null then
            exit;
          end if;

          insert into public.lineup_players (lineup_id, player_id, slot, is_starter, position)
          values (v_lineup.id, v_player_id, v_next_slot, true, v_position)
          on conflict (lineup_id, player_id) do update
          set is_starter = true,
              slot = excluded.slot,
              position = excluded.position;
        end if;

        v_fixed := v_fixed + 1;
        v_missing := v_missing - 1;
      end loop;
    end loop;
  end loop;

  raise notice 'lineup repair added or promoted % starters', v_fixed;
end $$;
