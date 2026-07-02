-- Add score_source field to matches table for selecting API source per match
-- Options: 'api_cricket' (current RapidAPI), 'espn' (ESPN Cricinfo), 'manual' (manual entry only)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS score_source text DEFAULT 'manual';

-- Add comment for clarity
COMMENT ON COLUMN public.matches.score_source IS 'Score source for this match: api_cricket (RapidAPI), espn (ESPN Cricinfo), or manual';

-- Add espn_event_id column for ESPN match linking
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS espn_event_id text;

COMMENT ON COLUMN public.matches.espn_event_id IS 'ESPN event ID for linking with ESPN Cricinfo API';