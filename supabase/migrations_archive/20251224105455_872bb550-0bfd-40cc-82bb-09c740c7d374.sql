-- Add match_minute column for live score tracking
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS match_minute integer DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN public.matches.match_minute IS 'Current match minute for live matches (e.g., 45 for halftime in football)';