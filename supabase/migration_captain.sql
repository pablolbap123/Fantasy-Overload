-- =====================================================
-- MIGRACIÓN: Capitán en alineaciones + ganancias
-- Ejecutar en el SQL Editor de Supabase
-- =====================================================

-- 1. Añadir columna capitán a lineups
ALTER TABLE public.lineups
  ADD COLUMN IF NOT EXISTS captain_player_id uuid REFERENCES public.players(id);

-- 2. Actualizar función submit_lineup_by_number para aceptar capitán
CREATE OR REPLACE FUNCTION public.submit_lineup_by_number(
  p_league_id uuid,
  p_matchday_number integer,
  p_formation text,
  p_starters uuid[],
  p_bench uuid[],
  p_captain_player_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lineup_id uuid;
  v_matchday_id uuid;
  v_user_id uuid := auth.uid();
BEGIN
  perform public.ensure_profile();

  IF NOT EXISTS (SELECT 1 FROM public.league_members WHERE league_id = p_league_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  IF coalesce(array_length(p_starters, 1), 0) <> 11 THEN
    RAISE EXCEPTION 'invalid_starter_count';
  END IF;

  -- Obtener matchday_id por número
  SELECT id INTO v_matchday_id
    FROM public.matchdays
   WHERE league_id = p_league_id AND number = p_matchday_number
   LIMIT 1;

  IF v_matchday_id IS NULL THEN
    RAISE EXCEPTION 'matchday_not_found';
  END IF;

  -- Validar que el capitán esté entre los titulares
  IF p_captain_player_id IS NOT NULL AND NOT (p_captain_player_id = ANY(p_starters)) THEN
    RAISE EXCEPTION 'captain_must_be_starter';
  END IF;

  -- Upsert lineup
  INSERT INTO public.lineups (league_id, user_id, matchday_id, formation, status, captain_player_id)
    VALUES (p_league_id, v_user_id, v_matchday_id, p_formation, 'submitted', p_captain_player_id)
    ON CONFLICT (league_id, user_id, matchday_id)
    DO UPDATE SET
      formation = EXCLUDED.formation,
      status = 'submitted',
      captain_player_id = EXCLUDED.captain_player_id
  RETURNING id INTO v_lineup_id;

  -- Borrar jugadores anteriores
  DELETE FROM public.lineup_players WHERE lineup_id = v_lineup_id;

  -- Insertar titulares
  INSERT INTO public.lineup_players (lineup_id, player_id, slot, is_starter, position)
  SELECT
    v_lineup_id,
    unnest(p_starters),
    generate_series(1, array_length(p_starters, 1)),
    true,
    (SELECT position FROM public.players WHERE id = unnest(p_starters) LIMIT 1)
  ;

  -- Re-insertar con posición correcta por jugador
  DELETE FROM public.lineup_players WHERE lineup_id = v_lineup_id AND is_starter = true;
  FOR i IN 1..array_length(p_starters, 1) LOOP
    INSERT INTO public.lineup_players (lineup_id, player_id, slot, is_starter, position)
    SELECT v_lineup_id, p_starters[i], i, true, pl.position
      FROM public.players pl WHERE pl.id = p_starters[i];
  END LOOP;

  -- Insertar suplentes
  FOR i IN 1..coalesce(array_length(p_bench, 1), 0) LOOP
    INSERT INTO public.lineup_players (lineup_id, player_id, slot, is_starter, position)
    SELECT v_lineup_id, p_bench[i], 11 + i, false, pl.position
      FROM public.players pl WHERE pl.id = p_bench[i]
    ON CONFLICT (lineup_id, player_id) DO NOTHING;
  END LOOP;

  RETURN v_lineup_id;
END;
$$;

-- 3. Función para calcular puntos de un manager en una jornada (respetando capitán ×2)
CREATE OR REPLACE FUNCTION public.calc_member_matchday_points(
  p_league_id uuid,
  p_user_id uuid,
  p_matchday_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points integer := 0;
  v_lineup_id uuid;
  v_captain_id uuid;
BEGIN
  SELECT id, captain_player_id INTO v_lineup_id, v_captain_id
    FROM public.lineups
   WHERE league_id = p_league_id AND user_id = p_user_id AND matchday_id = p_matchday_id
   LIMIT 1;

  IF v_lineup_id IS NULL THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(
    CASE
      WHEN lp.player_id = v_captain_id THEN (COALESCE(pms.fantasy_points, 0) * 2)
      ELSE COALESCE(pms.fantasy_points, 0)
    END
  ), 0)
  INTO v_points
  FROM public.lineup_players lp
  JOIN public.player_match_stats pms
    ON pms.player_id = lp.player_id
  JOIN public.matches m
    ON m.id = pms.match_id AND m.matchday_id = p_matchday_id
  WHERE lp.lineup_id = v_lineup_id
    AND lp.is_starter = true;

  RETURN v_points;
END;
$$;

-- 4. Función para distribuir ganancias cuando los 14 partidos de la jornada estén finalizados
-- Llama esta función manualmente o desde un trigger después de cada partido finalizado
CREATE OR REPLACE FUNCTION public.distribute_matchday_earnings(
  p_league_id uuid,
  p_matchday_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_matches integer;
  v_finished_matches integer;
  v_matchday_number integer;
  v_member RECORD;
  v_points integer;
  v_already_distributed boolean;
BEGIN
  -- Comprobar que TODOS los partidos de la jornada están finalizados
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'finalizada')
  INTO v_total_matches, v_finished_matches
  FROM public.matches
  WHERE matchday_id = p_matchday_id;

  IF v_total_matches = 0 OR v_finished_matches < v_total_matches THEN
    RAISE NOTICE 'Jornada % no finalizada completamente (% de % partidos)', p_matchday_id, v_finished_matches, v_total_matches;
    RETURN;
  END IF;

  SELECT number INTO v_matchday_number FROM public.matchdays WHERE id = p_matchday_id;

  -- Evitar doble distribución: comprobar si ya existe budget_event de tipo matchday_bonus para esta jornada
  SELECT EXISTS(
    SELECT 1 FROM public.budget_events
     WHERE league_id = p_league_id
       AND type = 'matchday_bonus'
       AND matchday_number = v_matchday_number
  ) INTO v_already_distributed;

  IF v_already_distributed THEN
    RAISE NOTICE 'Ganancias de jornada % ya distribuidas', v_matchday_number;
    RETURN;
  END IF;

  -- Para cada miembro de la liga, calcular puntos y dar premio en presupuesto
  -- Fórmula: 100.000 € por punto obtenido en la jornada
  FOR v_member IN
    SELECT user_id FROM public.league_members WHERE league_id = p_league_id
  LOOP
    v_points := public.calc_member_matchday_points(p_league_id, v_member.user_id, p_matchday_id);

    IF v_points > 0 THEN
      -- Añadir al presupuesto del manager
      UPDATE public.league_members
         SET budget = budget + (v_points * 100000)
       WHERE league_id = p_league_id AND user_id = v_member.user_id;

      -- Registrar el evento de presupuesto
      INSERT INTO public.budget_events (league_id, user_id, type, matchday_number, amount, description)
      VALUES (
        p_league_id,
        v_member.user_id,
        'matchday_bonus',
        v_matchday_number,
        v_points * 100000,
        format('Jornada %s: %s puntos × 100.000 € = %s €', v_matchday_number, v_points, v_points * 100000)
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'Ganancias de jornada % distribuidas correctamente', v_matchday_number;
END;
$$;
