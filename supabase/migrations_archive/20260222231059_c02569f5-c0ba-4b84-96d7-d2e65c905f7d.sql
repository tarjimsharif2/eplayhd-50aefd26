
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
  v_group_name TEXT := NULL;
  v_existing_a_id UUID;
  v_existing_b_id UUID;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    v_tournament_id := NEW.tournament_id;
    v_team_a_id := NEW.team_a_id;
    v_team_b_id := NEW.team_b_id;
    v_match_result := NEW.match_result;
    
    IF v_tournament_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    SELECT points_table_on_complete_sync_enabled INTO v_on_complete_sync
    FROM tournaments WHERE id = v_tournament_id;
    
    -- Find the common group_name where BOTH teams exist in the points table
    -- This handles multiple stages (Group Stage, Super Eight, etc.)
    SELECT a.group_name INTO v_group_name
    FROM tournament_points_table a
    JOIN tournament_points_table b ON a.tournament_id = b.tournament_id AND a.group_name IS NOT DISTINCT FROM b.group_name
    WHERE a.tournament_id = v_tournament_id
      AND a.team_id = v_team_a_id
      AND b.team_id = v_team_b_id
    ORDER BY a.created_at DESC
    LIMIT 1;
    
    RAISE LOG 'update_points_on_match_complete: tournament=%, team_a=%, team_b=%, group=%', 
      v_tournament_id, v_team_a_id, v_team_b_id, COALESCE(v_group_name, 'NULL');
    
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
      
      -- Team A: Check if entry exists for this group
      SELECT id INTO v_existing_a_id
      FROM tournament_points_table
      WHERE tournament_id = v_tournament_id AND team_id = v_team_a_id
        AND group_name IS NOT DISTINCT FROM v_group_name;
      
      IF v_existing_a_id IS NOT NULL THEN
        UPDATE tournament_points_table SET
          played = played + 1,
          won = won + CASE WHEN v_winner_id = v_team_a_id THEN 1 ELSE 0 END,
          lost = lost + CASE WHEN v_loser_id = v_team_a_id THEN 1 ELSE 0 END,
          tied = tied + CASE WHEN v_is_tied OR v_is_draw THEN 1 ELSE 0 END,
          no_result = no_result + CASE WHEN v_is_no_result THEN 1 ELSE 0 END,
          points = points + CASE WHEN v_winner_id = v_team_a_id THEN 2 WHEN v_is_tied OR v_is_draw OR v_is_no_result THEN 1 ELSE 0 END,
          runs_scored = COALESCE(runs_scored, 0) + v_team_a_runs,
          overs_faced = COALESCE(overs_faced, 0) + v_team_a_overs,
          runs_conceded = COALESCE(runs_conceded, 0) + v_team_b_runs,
          overs_bowled = COALESCE(overs_bowled, 0) + v_team_b_overs,
          head_to_head = CASE 
            WHEN v_winner_id = v_team_a_id THEN 
              jsonb_set(COALESCE(head_to_head, '{}'::jsonb), ARRAY[v_team_b_id::text],
                jsonb_build_object('won', COALESCE((head_to_head->v_team_b_id::text->>'won')::int, 0) + 1, 'lost', COALESCE((head_to_head->v_team_b_id::text->>'lost')::int, 0)))
            WHEN v_loser_id = v_team_a_id THEN 
              jsonb_set(COALESCE(head_to_head, '{}'::jsonb), ARRAY[v_team_b_id::text],
                jsonb_build_object('won', COALESCE((head_to_head->v_team_b_id::text->>'won')::int, 0), 'lost', COALESCE((head_to_head->v_team_b_id::text->>'lost')::int, 0) + 1))
            ELSE head_to_head
          END,
          updated_at = now()
        WHERE id = v_existing_a_id;
      ELSE
        INSERT INTO tournament_points_table (
          tournament_id, team_id, group_name, played, won, lost, tied, no_result, points, position,
          runs_scored, overs_faced, runs_conceded, overs_bowled, head_to_head
        ) VALUES (
          v_tournament_id, v_team_a_id, v_group_name, 1,
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
        );
      END IF;
      
      -- Team B: Check if entry exists for this group
      SELECT id INTO v_existing_b_id
      FROM tournament_points_table
      WHERE tournament_id = v_tournament_id AND team_id = v_team_b_id
        AND group_name IS NOT DISTINCT FROM v_group_name;
      
      IF v_existing_b_id IS NOT NULL THEN
        UPDATE tournament_points_table SET
          played = played + 1,
          won = won + CASE WHEN v_winner_id = v_team_b_id THEN 1 ELSE 0 END,
          lost = lost + CASE WHEN v_loser_id = v_team_b_id THEN 1 ELSE 0 END,
          tied = tied + CASE WHEN v_is_tied OR v_is_draw THEN 1 ELSE 0 END,
          no_result = no_result + CASE WHEN v_is_no_result THEN 1 ELSE 0 END,
          points = points + CASE WHEN v_winner_id = v_team_b_id THEN 2 WHEN v_is_tied OR v_is_draw OR v_is_no_result THEN 1 ELSE 0 END,
          runs_scored = COALESCE(runs_scored, 0) + v_team_b_runs,
          overs_faced = COALESCE(overs_faced, 0) + v_team_b_overs,
          runs_conceded = COALESCE(runs_conceded, 0) + v_team_a_runs,
          overs_bowled = COALESCE(overs_bowled, 0) + v_team_a_overs,
          head_to_head = CASE 
            WHEN v_winner_id = v_team_b_id THEN 
              jsonb_set(COALESCE(head_to_head, '{}'::jsonb), ARRAY[v_team_a_id::text],
                jsonb_build_object('won', COALESCE((head_to_head->v_team_a_id::text->>'won')::int, 0) + 1, 'lost', COALESCE((head_to_head->v_team_a_id::text->>'lost')::int, 0)))
            WHEN v_loser_id = v_team_b_id THEN 
              jsonb_set(COALESCE(head_to_head, '{}'::jsonb), ARRAY[v_team_a_id::text],
                jsonb_build_object('won', COALESCE((head_to_head->v_team_a_id::text->>'won')::int, 0), 'lost', COALESCE((head_to_head->v_team_a_id::text->>'lost')::int, 0) + 1))
            ELSE head_to_head
          END,
          updated_at = now()
        WHERE id = v_existing_b_id;
      ELSE
        INSERT INTO tournament_points_table (
          tournament_id, team_id, group_name, played, won, lost, tied, no_result, points, position,
          runs_scored, overs_faced, runs_conceded, overs_bowled, head_to_head
        ) VALUES (
          v_tournament_id, v_team_b_id, v_group_name, 1,
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
        );
      END IF;
      
      -- Update NRR for both teams in this group
      UPDATE tournament_points_table SET
        net_run_rate = CASE 
          WHEN COALESCE(overs_faced, 0) > 0 AND COALESCE(overs_bowled, 0) > 0 THEN
            ROUND(((COALESCE(runs_scored, 0)::numeric / NULLIF(overs_faced, 0)) - (COALESCE(runs_conceded, 0)::numeric / NULLIF(overs_bowled, 0)))::numeric, 3)
          ELSE 0
        END
      WHERE tournament_id = v_tournament_id 
        AND team_id IN (v_team_a_id, v_team_b_id)
        AND group_name IS NOT DISTINCT FROM v_group_name;
      
      PERFORM public.recalculate_tournament_positions(v_tournament_id);
    END IF;
    
    IF v_on_complete_sync THEN
      BEGIN
        PERFORM net.http_post(
          url := 'https://doqteforumjdugifxryl.supabase.co/functions/v1/sync-points-table',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcXRlZm9ydW1qZHVnaWZ4cnlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NDY5NjQsImV4cCI6MjA4MjEyMjk2NH0.TzRAPhPWC6WN_IR24qEWA8TznqlrqPirJBdDmWyT9n8"}'::jsonb,
          body := jsonb_build_object('tournamentId', v_tournament_id),
          timeout_milliseconds := 30000
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
