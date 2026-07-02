-- Function to automatically reassign clean slug when match is completed
CREATE OR REPLACE FUNCTION public.reassign_slug_on_match_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_base_slug TEXT;
  v_next_match_id UUID;
  v_next_match_slug TEXT;
  v_slug_number INTEGER;
BEGIN
  -- Only process if status changed to 'completed' and match has a slug
  IF NEW.status = 'completed' 
     AND (OLD.status IS NULL OR OLD.status != 'completed') 
     AND NEW.slug IS NOT NULL 
  THEN
    -- Check if this is a clean slug (ends with -live, not -live-N)
    IF NEW.slug ~ '^.+-live$' AND NEW.slug !~ '^.+-live-\d+$' THEN
      v_base_slug := NEW.slug;
      
      -- Find the next upcoming/live match with numbered slug (e.g., team-a-vs-team-b-live-2)
      SELECT id, slug INTO v_next_match_id, v_next_match_slug
      FROM matches
      WHERE slug ~ ('^' || regexp_replace(v_base_slug, '-', '\\-', 'g') || '-\d+$')
        AND status IN ('upcoming', 'live')
        AND id != NEW.id
      ORDER BY 
        CASE WHEN status = 'live' THEN 0 ELSE 1 END,
        match_start_time ASC NULLS LAST,
        match_date ASC,
        match_time ASC
      LIMIT 1;
      
      IF v_next_match_id IS NOT NULL THEN
        -- Extract the number from the next match's slug
        v_slug_number := (regexp_match(v_next_match_slug, '-(\d+)$'))[1]::INTEGER;
        
        -- Give the clean slug to the next match
        UPDATE matches SET slug = v_base_slug WHERE id = v_next_match_id;
        
        -- Give the completed match a numbered slug
        UPDATE matches SET slug = v_base_slug || '-' || v_slug_number WHERE id = NEW.id;
        
        -- Update NEW to reflect the change (for the trigger return)
        NEW.slug := v_base_slug || '-' || v_slug_number;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to auto-reassign slug on match completion
DROP TRIGGER IF EXISTS trigger_reassign_slug_on_complete ON matches;
CREATE TRIGGER trigger_reassign_slug_on_complete
  BEFORE UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION reassign_slug_on_match_complete();