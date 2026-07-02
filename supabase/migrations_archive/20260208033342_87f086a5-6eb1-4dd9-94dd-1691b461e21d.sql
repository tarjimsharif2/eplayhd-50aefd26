-- Create a trigger function that auto-calculates football score from goals arrays
CREATE OR REPLACE FUNCTION public.auto_calculate_football_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sport_name TEXT;
  v_goals_a JSONB;
  v_goals_b JSONB;
  v_score_a INTEGER := 0;
  v_score_b INTEGER := 0;
  v_goal JSONB;
BEGIN
  -- Only process if goals changed
  IF (NEW.goals_team_a IS NOT DISTINCT FROM OLD.goals_team_a) 
     AND (NEW.goals_team_b IS NOT DISTINCT FROM OLD.goals_team_b) THEN
    RETURN NEW;
  END IF;

  -- Check if this is a football match
  IF NEW.sport_id IS NOT NULL THEN
    SELECT name INTO v_sport_name FROM sports WHERE id = NEW.sport_id;
    IF v_sport_name IS NULL OR v_sport_name NOT ILIKE '%football%' THEN
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  v_goals_a := COALESCE(NEW.goals_team_a, '[]'::jsonb);
  v_goals_b := COALESCE(NEW.goals_team_b, '[]'::jsonb);

  -- Count goals for team A: regular goals + own goals by team B
  FOR v_goal IN SELECT * FROM jsonb_array_elements(v_goals_a)
  LOOP
    IF (v_goal->>'type') != 'own_goal' THEN
      v_score_a := v_score_a + 1;
    ELSE
      v_score_b := v_score_b + 1;
    END IF;
  END LOOP;

  -- Count goals for team B: regular goals + own goals by team A
  FOR v_goal IN SELECT * FROM jsonb_array_elements(v_goals_b)
  LOOP
    IF (v_goal->>'type') != 'own_goal' THEN
      v_score_b := v_score_b + 1;
    ELSE
      v_score_a := v_score_a + 1;
    END IF;
  END LOOP;

  -- Update scores
  NEW.score_a := v_score_a::text;
  NEW.score_b := v_score_b::text;

  RETURN NEW;
END;
$$;

-- Create the trigger (BEFORE UPDATE so it modifies the row in-place)
DROP TRIGGER IF EXISTS auto_calculate_football_score_trigger ON matches;
CREATE TRIGGER auto_calculate_football_score_trigger
  BEFORE UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_calculate_football_score();
