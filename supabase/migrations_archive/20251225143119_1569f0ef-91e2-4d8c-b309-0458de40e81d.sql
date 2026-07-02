-- Add match_result field to matches table
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS match_result text NULL;

-- Add head_to_head tracking columns to tournament_points_table
ALTER TABLE public.tournament_points_table
ADD COLUMN IF NOT EXISTS runs_scored integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS overs_faced numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS runs_conceded integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS overs_bowled numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS head_to_head jsonb DEFAULT '{}'::jsonb;

-- Drop existing trigger with correct name and function with CASCADE
DROP TRIGGER IF EXISTS update_points_on_match_complete_trigger ON public.matches;
DROP TRIGGER IF EXISTS trigger_update_points_on_match_complete ON public.matches;
DROP FUNCTION IF EXISTS public.update_points_on_match_complete() CASCADE;

-- Create improved function to update points table on match completion
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
BEGIN
  -- Only process if status changed to 'completed' and match_result is set
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    v_tournament_id := NEW.tournament_id;
    v_team_a_id := NEW.team_a_id;
    v_team_b_id := NEW.team_b_id;
    v_match_result := NEW.match_result;
    
    -- Only update if match has a tournament
    IF v_tournament_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Determine match outcome from match_result field
    CASE v_match_result
      WHEN 'team_a_won' THEN
        v_winner_id := v_team_a_id;
        v_loser_id := v_team_b_id;
      WHEN 'team_b_won' THEN
        v_winner_id := v_team_b_id;
        v_loser_id := v_team_a_id;
      WHEN 'tied' THEN
        v_is_tied := true;
      WHEN 'no_result' THEN
        v_is_no_result := true;
      WHEN 'draw' THEN
        v_is_draw := true;
      ELSE
        -- No result set, skip processing
        RETURN NEW;
    END CASE;
    
    -- Calculate runs and overs from innings data for NRR
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
    
    -- Update or insert team A points
    INSERT INTO tournament_points_table (
      tournament_id, team_id, played, won, lost, tied, no_result, points, position,
      runs_scored, overs_faced, runs_conceded, overs_bowled, head_to_head
    )
    VALUES (
      v_tournament_id, 
      v_team_a_id, 
      1,
      CASE WHEN v_winner_id = v_team_a_id THEN 1 ELSE 0 END,
      CASE WHEN v_loser_id = v_team_a_id THEN 1 ELSE 0 END,
      CASE WHEN v_is_tied OR v_is_draw THEN 1 ELSE 0 END,
      CASE WHEN v_is_no_result THEN 1 ELSE 0 END,
      CASE 
        WHEN v_winner_id = v_team_a_id THEN 2
        WHEN v_is_tied OR v_is_draw OR v_is_no_result THEN 1
        ELSE 0
      END,
      0,
      v_team_a_runs,
      v_team_a_overs,
      v_team_b_runs,
      v_team_b_overs,
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
      points = tournament_points_table.points + CASE 
        WHEN v_winner_id = v_team_a_id THEN 2
        WHEN v_is_tied OR v_is_draw OR v_is_no_result THEN 1
        ELSE 0
      END,
      runs_scored = COALESCE(tournament_points_table.runs_scored, 0) + v_team_a_runs,
      overs_faced = COALESCE(tournament_points_table.overs_faced, 0) + v_team_a_overs,
      runs_conceded = COALESCE(tournament_points_table.runs_conceded, 0) + v_team_b_runs,
      overs_bowled = COALESCE(tournament_points_table.overs_bowled, 0) + v_team_b_overs,
      head_to_head = CASE 
        WHEN v_winner_id = v_team_a_id THEN 
          jsonb_set(
            COALESCE(tournament_points_table.head_to_head, '{}'::jsonb),
            ARRAY[v_team_b_id::text],
            jsonb_build_object(
              'won', COALESCE((tournament_points_table.head_to_head->v_team_b_id::text->>'won')::int, 0) + 1,
              'lost', COALESCE((tournament_points_table.head_to_head->v_team_b_id::text->>'lost')::int, 0)
            )
          )
        WHEN v_loser_id = v_team_a_id THEN 
          jsonb_set(
            COALESCE(tournament_points_table.head_to_head, '{}'::jsonb),
            ARRAY[v_team_b_id::text],
            jsonb_build_object(
              'won', COALESCE((tournament_points_table.head_to_head->v_team_b_id::text->>'won')::int, 0),
              'lost', COALESCE((tournament_points_table.head_to_head->v_team_b_id::text->>'lost')::int, 0) + 1
            )
          )
        ELSE tournament_points_table.head_to_head
      END,
      updated_at = now();
    
    -- Update or insert team B points
    INSERT INTO tournament_points_table (
      tournament_id, team_id, played, won, lost, tied, no_result, points, position,
      runs_scored, overs_faced, runs_conceded, overs_bowled, head_to_head
    )
    VALUES (
      v_tournament_id, 
      v_team_b_id, 
      1,
      CASE WHEN v_winner_id = v_team_b_id THEN 1 ELSE 0 END,
      CASE WHEN v_loser_id = v_team_b_id THEN 1 ELSE 0 END,
      CASE WHEN v_is_tied OR v_is_draw THEN 1 ELSE 0 END,
      CASE WHEN v_is_no_result THEN 1 ELSE 0 END,
      CASE 
        WHEN v_winner_id = v_team_b_id THEN 2
        WHEN v_is_tied OR v_is_draw OR v_is_no_result THEN 1
        ELSE 0
      END,
      0,
      v_team_b_runs,
      v_team_b_overs,
      v_team_a_runs,
      v_team_a_overs,
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
      points = tournament_points_table.points + CASE 
        WHEN v_winner_id = v_team_b_id THEN 2
        WHEN v_is_tied OR v_is_draw OR v_is_no_result THEN 1
        ELSE 0
      END,
      runs_scored = COALESCE(tournament_points_table.runs_scored, 0) + v_team_b_runs,
      overs_faced = COALESCE(tournament_points_table.overs_faced, 0) + v_team_b_overs,
      runs_conceded = COALESCE(tournament_points_table.runs_conceded, 0) + v_team_a_runs,
      overs_bowled = COALESCE(tournament_points_table.overs_bowled, 0) + v_team_a_overs,
      head_to_head = CASE 
        WHEN v_winner_id = v_team_b_id THEN 
          jsonb_set(
            COALESCE(tournament_points_table.head_to_head, '{}'::jsonb),
            ARRAY[v_team_a_id::text],
            jsonb_build_object(
              'won', COALESCE((tournament_points_table.head_to_head->v_team_a_id::text->>'won')::int, 0) + 1,
              'lost', COALESCE((tournament_points_table.head_to_head->v_team_a_id::text->>'lost')::int, 0)
            )
          )
        WHEN v_loser_id = v_team_b_id THEN 
          jsonb_set(
            COALESCE(tournament_points_table.head_to_head, '{}'::jsonb),
            ARRAY[v_team_a_id::text],
            jsonb_build_object(
              'won', COALESCE((tournament_points_table.head_to_head->v_team_a_id::text->>'won')::int, 0),
              'lost', COALESCE((tournament_points_table.head_to_head->v_team_a_id::text->>'lost')::int, 0) + 1
            )
          )
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
    
    -- Auto-update positions for all teams in the tournament
    WITH ranked_teams AS (
      SELECT 
        id,
        ROW_NUMBER() OVER (
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
  
  RETURN NEW;
END;
$function$;

-- Create the trigger
CREATE TRIGGER trigger_update_points_on_match_complete
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_points_on_match_complete();

-- Create function to recalculate all positions for a tournament
CREATE OR REPLACE FUNCTION public.recalculate_tournament_positions(p_tournament_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE tournament_points_table SET
    net_run_rate = CASE 
      WHEN COALESCE(overs_faced, 0) > 0 AND COALESCE(overs_bowled, 0) > 0 THEN
        ROUND(((COALESCE(runs_scored, 0)::numeric / NULLIF(overs_faced, 0)) - (COALESCE(runs_conceded, 0)::numeric / NULLIF(overs_bowled, 0)))::numeric, 3)
      ELSE 0
    END
  WHERE tournament_id = p_tournament_id;
  
  WITH ranked_teams AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        ORDER BY 
          COALESCE(points, 0) DESC,
          COALESCE(net_run_rate, 0) DESC,
          COALESCE(won, 0) DESC
      ) as new_position
    FROM tournament_points_table
    WHERE tournament_id = p_tournament_id
  )
  UPDATE tournament_points_table t
  SET position = r.new_position
  FROM ranked_teams r
  WHERE t.id = r.id;
END;
$function$;