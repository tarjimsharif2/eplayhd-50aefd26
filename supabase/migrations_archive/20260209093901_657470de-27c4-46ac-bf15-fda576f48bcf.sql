
CREATE OR REPLACE FUNCTION public.update_points_on_match_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tournament_id UUID;
  v_team_a_id UUID;
  v_team_b_id UUID;
  v_match_result TEXT;
  v_winner_id UUID;
  v_loser_id UUID;
  v_is_tied BOOLEAN := false;
  v_is_no_result BOOLEAN := false;
  v_is_draw BOOLEAN := false;
  v_team_a_runs INTEGER := 0;
  v_team_a_overs NUMERIC := 0;
  v_team_b_runs INTEGER := 0;
  v_team_b_overs NUMERIC := 0;
  v_innings_record RECORD;
  v_on_complete_sync BOOLEAN := false;
  v_has_valid_result BOOLEAN := false;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    v_tournament_id := NEW.tournament_id;
    v_team_a_id := NEW.team_a_id;
    v_team_b_id := NEW.team_b_id;
    v_match_result := NEW.match_result;
    
    IF v_tournament_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Check if on-complete sync is enabled for this tournament
    SELECT points_table_on_complete_sync_enabled INTO v_on_complete_sync
    FROM tournaments WHERE id = v_tournament_id;
    
    -- Determine if we have a valid match result for direct points update
    CASE v_match_result
      WHEN 'team_a_won' THEN
        v_winner_id := v_team_a_id;
        v_loser_id := v_team_b_id;
        v_has_valid_result := true;
      WHEN 'team_b_won' THEN
        v_winner_id := v_team_b_id;
        v_loser_id := v_team_a_id;
        v_has_valid_result := true;
      WHEN 'tied' THEN
        v_is_tied := true;
        v_has_valid_result := true;
      WHEN 'no_result' THEN
        v_is_no_result := true;
        v_has_valid_result := true;
      WHEN 'draw' THEN
        v_is_draw := true;
        v_has_valid_result := true;
      ELSE
        v_has_valid_result := false;
    END CASE;
    
    -- If we have a valid result, update points directly
    IF v_has_valid_result THEN
      FOR v_innings_record IN 
        SELECT batting_team_id, COALESCE(runs, 0) as runs, COALESCE(overs, 0) as overs
        FROM match_innings 
        WHERE match_id = NEW.id
      LOOP
        IF v_innings_record.batting_team_id = v_team_a_id THEN
          v_team_a_runs := v_team_a_runs + v_innings_record.runs;
          v_team_a_overs := v_team_a_overs + v_innings_record.overs;
        ELSIF v_innings_record.batting_team_id = v_team_b_id THEN
          v_team_b_runs := v_team_b_runs + v_innings_record.runs;
          v_team_b_overs := v_team_b_overs + v_innings_record.overs;
        END IF;
      END LOOP;
      
      -- Insert/Update team A
      INSERT INTO tournament_points_table (
        tournament_id, team_id, played, won, lost, tied, no_result, points, position,
        runs_scored, overs_faced, runs_conceded, overs_bowled, head_to_head
      )
      VALUES (
        v_tournament_id, v_team_a_id, 1,
        CASE WHEN v_winner_id = v_team_a_id THEN 1 ELSE 0 END,
        CASE WHEN v_loser_id = v_team_a_id THEN 1 ELSE 0 END,
        CASE WHEN v_is_tied OR v_is_draw THEN 1 ELSE 0 END,
        CASE WHEN v_is_no_result THEN 1 ELSE 0 END,
        CASE WHEN v_winner_id = v_team_a_id THEN 2 WHEN v_is_tied OR v_is_draw OR v_is_no_result THEN 1 ELSE 0 END,
        0, v_team_a_runs, v_team_a_overs, v_team_b_runs, v_team_b_overs,
        CASE 
          WHEN v_winner_id = v_team_a_id THEN jsonb_build_object(v_team_b_id::text, jsonb_build_object('won', 1, 'lost', 0))
          WHEN v_loser_id = v_team_a_id THEN jsonb_build_object(v_team_b_id::text, jsonb_build_object('won', 0, 'lost', 1))
          ELSE '{}'::jsonb
        END
      )
      ON CONFLICT (tournament_id, team_id) DO UPDATE SET
        played = tournament_points_table.played + 1,
        won = tournament_points_table.won + CASE WHEN v_winner_id = v_team_a_id THEN 1 ELSE 0 END,
        lost = tournament_points_table.lost + CASE WHEN v_loser_id = v_team_a_id THEN 1 ELSE 0 END,
        tied = tournament_points_table.tied + CASE WHEN v_is_tied OR v_is_draw THEN 1 ELSE 0 END,
        no_result = tournament_points_table.no_result + CASE WHEN v_is_no_result THEN 1 ELSE 0 END,
        points = tournament_points_table.points + CASE WHEN v_winner_id = v_team_a_id THEN 2 WHEN v_is_tied OR v_is_draw OR v_is_no_result THEN 1 ELSE 0 END,
        runs_scored = COALESCE(tournament_points_table.runs_scored, 0) + v_team_a_runs,
        overs_faced = COALESCE(tournament_points_table.overs_faced, 0) + v_team_a_overs,
        runs_conceded = COALESCE(tournament_points_table.runs_conceded, 0) + v_team_b_runs,
        overs_bowled = COALESCE(tournament_points_table.overs_bowled, 0) + v_team_b_overs,
        head_to_head = CASE 
          WHEN v_winner_id = v_team_a_id THEN 
            jsonb_set(COALESCE(tournament_points_table.head_to_head, '{}'::jsonb), ARRAY[v_team_b_id::text],
              jsonb_build_object('won', COALESCE((tournament_points_table.head_to_head->v_team_b_id::text->>'won')::int, 0) + 1, 'lost', COALESCE((tournament_points_table.head_to_head->v_team_b_id::text->>'lost')::int, 0)))
          WHEN v_loser_id = v_team_a_id THEN 
            jsonb_set(COALESCE(tournament_points_table.head_to_head, '{}'::jsonb), ARRAY[v_team_b_id::text],
              jsonb_build_object('won', COALESCE((tournament_points_table.head_to_head->v_team_b_id::text->>'won')::int, 0), 'lost', COALESCE((tournament_points_table.head_to_head->v_team_b_id::text->>'lost')::int, 0) + 1))
          ELSE tournament_points_table.head_to_head
        END,
        updated_at = now();
      
      -- Insert/Update team B
      INSERT INTO tournament_points_table (
        tournament_id, team_id, played, won, lost, tied, no_result, points, position,
        runs_scored, overs_faced, runs_conceded, overs_bowled, head_to_head
      )
      VALUES (
        v_tournament_id, v_team_b_id, 1,
        CASE WHEN v_winner_id = v_team_b_id THEN 1 ELSE 0 END,
        CASE WHEN v_loser_id = v_team_b_id THEN 1 ELSE 0 END,
        CASE WHEN v_is_tied OR v_is_draw THEN 1 ELSE 0 END,
        CASE WHEN v_is_no_result THEN 1 ELSE 0 END,
        CASE WHEN v_winner_id = v_team_b_id THEN 2 WHEN v_is_tied OR v_is_draw OR v_is_no_result THEN 1 ELSE 0 END,
        0, v_team_b_runs, v_team_b_overs, v_team_a_runs, v_team_a_overs,
        CASE 
          WHEN v_winner_id = v_team_b_id THEN jsonb_build_object(v_team_a_id::text, jsonb_build_object('won', 1, 'lost', 0))
          WHEN v_loser_id = v_team_b_id THEN jsonb_build_object(v_team_a_id::text, jsonb_build_object('won', 0, 'lost', 1))
          ELSE '{}'::jsonb
        END
      )
      ON CONFLICT (tournament_id, team_id) DO UPDATE SET
        played = tournament_points_table.played + 1,
        won = tournament_points_table.won + CASE WHEN v_winner_id = v_team_b_id THEN 1 ELSE 0 END,
        lost = tournament_points_table.lost + CASE WHEN v_loser_id = v_team_b_id THEN 1 ELSE 0 END,
        tied = tournament_points_table.tied + CASE WHEN v_is_tied OR v_is_draw THEN 1 ELSE 0 END,
        no_result = tournament_points_table.no_result + CASE WHEN v_is_no_result THEN 1 ELSE 0 END,
        points = tournament_points_table.points + CASE WHEN v_winner_id = v_team_b_id THEN 2 WHEN v_is_tied OR v_is_draw OR v_is_no_result THEN 1 ELSE 0 END,
        runs_scored = COALESCE(tournament_points_table.runs_scored, 0) + v_team_b_runs,
        overs_faced = COALESCE(tournament_points_table.overs_faced, 0) + v_team_b_overs,
        runs_conceded = COALESCE(tournament_points_table.runs_conceded, 0) + v_team_a_runs,
        overs_bowled = COALESCE(tournament_points_table.overs_bowled, 0) + v_team_a_overs,
        head_to_head = CASE 
          WHEN v_winner_id = v_team_b_id THEN 
            jsonb_set(COALESCE(tournament_points_table.head_to_head, '{}'::jsonb), ARRAY[v_team_a_id::text],
              jsonb_build_object('won', COALESCE((tournament_points_table.head_to_head->v_team_a_id::text->>'won')::int, 0) + 1, 'lost', COALESCE((tournament_points_table.head_to_head->v_team_a_id::text->>'lost')::int, 0)))
          WHEN v_loser_id = v_team_b_id THEN 
            jsonb_set(COALESCE(tournament_points_table.head_to_head, '{}'::jsonb), ARRAY[v_team_a_id::text],
              jsonb_build_object('won', COALESCE((tournament_points_table.head_to_head->v_team_a_id::text->>'won')::int, 0), 'lost', COALESCE((tournament_points_table.head_to_head->v_team_a_id::text->>'lost')::int, 0) + 1))
          ELSE tournament_points_table.head_to_head
        END,
        updated_at = now();
      
      -- Update NRR for both teams
      UPDATE tournament_points_table SET
        net_run_rate = CASE 
          WHEN COALESCE(overs_faced, 0) > 0 AND COALESCE(overs_bowled, 0) > 0 THEN
            ROUND(((COALESCE(runs_scored, 0)::numeric / NULLIF(overs_faced, 0)) - (COALESCE(runs_conceded, 0)::numeric / NULLIF(overs_bowled, 0)))::numeric, 3)
          ELSE 0
        END
      WHERE tournament_id = v_tournament_id 
        AND team_id IN (v_team_a_id, v_team_b_id);
      
      -- Auto-update positions WITHIN each group
      WITH ranked_teams AS (
        SELECT 
          id,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(group_name, '__no_group__')
            ORDER BY 
              COALESCE(points, 0) DESC,
              COALESCE(net_run_rate, 0) DESC,
              COALESCE(won, 0) DESC
          ) as new_position
        FROM tournament_points_table
        WHERE tournament_id = v_tournament_id
      )
      UPDATE tournament_points_table t
      SET position = r.new_position
      FROM ranked_teams r
      WHERE t.id = r.id;
    END IF;
    
    -- ALWAYS trigger API sync if on-complete sync is enabled, regardless of match_result
    -- This ensures points table gets updated from API even when match_result is NULL
    IF v_on_complete_sync THEN
      BEGIN
        PERFORM net.http_post(
          url := 'https://doqteforumjdugifxryl.supabase.co/functions/v1/sync-points-table',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcXRlZm9ydW1qZHVnaWZ4cnlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NDY5NjQsImV4cCI6MjA4MjEyMjk2NH0.TzRAPhPWC6WN_IR24qEWA8TznqlrqPirJBdDmWyT9n8"}'::jsonb,
          body := jsonb_build_object('tournamentId', v_tournament_id)
        );
        RAISE LOG 'Points table on-complete sync triggered for tournament % (match_result: %)', v_tournament_id, COALESCE(v_match_result, 'NULL');
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'Failed to trigger on-complete sync for tournament %: %', v_tournament_id, SQLERRM;
      END;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$function$;
