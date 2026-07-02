-- Create a function to update points table when a match is marked completed
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
  v_score_a TEXT;
  v_score_b TEXT;
  v_winner_id UUID;
  v_loser_id UUID;
  v_is_tied BOOLEAN;
  v_is_no_result BOOLEAN;
BEGIN
  -- Only process if status changed to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get match details
    v_tournament_id := NEW.tournament_id;
    v_team_a_id := NEW.team_a_id;
    v_team_b_id := NEW.team_b_id;
    v_score_a := COALESCE(NEW.score_a, '');
    v_score_b := COALESCE(NEW.score_b, '');
    
    -- Only update if match has a tournament
    IF v_tournament_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Determine match result based on score patterns
    -- Check for no result
    v_is_no_result := (
      LOWER(v_score_a) LIKE '%no result%' OR 
      LOWER(v_score_b) LIKE '%no result%' OR
      LOWER(v_score_a) LIKE '%nr%' OR 
      LOWER(v_score_b) LIKE '%nr%' OR
      LOWER(v_score_a) LIKE '%abandoned%' OR 
      LOWER(v_score_b) LIKE '%abandoned%'
    );
    
    -- Check for tie
    v_is_tied := (
      LOWER(v_score_a) LIKE '%tied%' OR 
      LOWER(v_score_b) LIKE '%tied%' OR
      LOWER(v_score_a) LIKE '%draw%' OR 
      LOWER(v_score_b) LIKE '%draw%'
    );
    
    -- Determine winner based on score text (e.g., "Won by X runs", "Won", etc.)
    IF NOT v_is_no_result AND NOT v_is_tied THEN
      IF LOWER(v_score_a) LIKE '%won%' THEN
        v_winner_id := v_team_a_id;
        v_loser_id := v_team_b_id;
      ELSIF LOWER(v_score_b) LIKE '%won%' THEN
        v_winner_id := v_team_b_id;
        v_loser_id := v_team_a_id;
      END IF;
    END IF;
    
    -- Update or insert team A points
    INSERT INTO tournament_points_table (tournament_id, team_id, played, won, lost, tied, no_result, points, position)
    VALUES (
      v_tournament_id, 
      v_team_a_id, 
      1,
      CASE WHEN v_winner_id = v_team_a_id THEN 1 ELSE 0 END,
      CASE WHEN v_loser_id = v_team_a_id THEN 1 ELSE 0 END,
      CASE WHEN v_is_tied THEN 1 ELSE 0 END,
      CASE WHEN v_is_no_result THEN 1 ELSE 0 END,
      CASE 
        WHEN v_winner_id = v_team_a_id THEN 2
        WHEN v_is_tied THEN 1
        WHEN v_is_no_result THEN 1
        ELSE 0
      END,
      0
    )
    ON CONFLICT (tournament_id, team_id) DO UPDATE SET
      played = tournament_points_table.played + 1,
      won = tournament_points_table.won + CASE WHEN v_winner_id = v_team_a_id THEN 1 ELSE 0 END,
      lost = tournament_points_table.lost + CASE WHEN v_loser_id = v_team_a_id THEN 1 ELSE 0 END,
      tied = tournament_points_table.tied + CASE WHEN v_is_tied THEN 1 ELSE 0 END,
      no_result = tournament_points_table.no_result + CASE WHEN v_is_no_result THEN 1 ELSE 0 END,
      points = tournament_points_table.points + CASE 
        WHEN v_winner_id = v_team_a_id THEN 2
        WHEN v_is_tied THEN 1
        WHEN v_is_no_result THEN 1
        ELSE 0
      END,
      updated_at = now();
    
    -- Update or insert team B points
    INSERT INTO tournament_points_table (tournament_id, team_id, played, won, lost, tied, no_result, points, position)
    VALUES (
      v_tournament_id, 
      v_team_b_id, 
      1,
      CASE WHEN v_winner_id = v_team_b_id THEN 1 ELSE 0 END,
      CASE WHEN v_loser_id = v_team_b_id THEN 1 ELSE 0 END,
      CASE WHEN v_is_tied THEN 1 ELSE 0 END,
      CASE WHEN v_is_no_result THEN 1 ELSE 0 END,
      CASE 
        WHEN v_winner_id = v_team_b_id THEN 2
        WHEN v_is_tied THEN 1
        WHEN v_is_no_result THEN 1
        ELSE 0
      END,
      0
    )
    ON CONFLICT (tournament_id, team_id) DO UPDATE SET
      played = tournament_points_table.played + 1,
      won = tournament_points_table.won + CASE WHEN v_winner_id = v_team_b_id THEN 1 ELSE 0 END,
      lost = tournament_points_table.lost + CASE WHEN v_loser_id = v_team_b_id THEN 1 ELSE 0 END,
      tied = tournament_points_table.tied + CASE WHEN v_is_tied THEN 1 ELSE 0 END,
      no_result = tournament_points_table.no_result + CASE WHEN v_is_no_result THEN 1 ELSE 0 END,
      points = tournament_points_table.points + CASE 
        WHEN v_winner_id = v_team_b_id THEN 2
        WHEN v_is_tied THEN 1
        WHEN v_is_no_result THEN 1
        ELSE 0
      END,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Add unique constraint for upsert to work
ALTER TABLE tournament_points_table 
ADD CONSTRAINT tournament_points_table_tournament_team_unique 
UNIQUE (tournament_id, team_id);

-- Create trigger for automatic points update
CREATE TRIGGER update_points_on_match_complete_trigger
  AFTER UPDATE OF status ON matches
  FOR EACH ROW
  EXECUTE FUNCTION update_points_on_match_complete();