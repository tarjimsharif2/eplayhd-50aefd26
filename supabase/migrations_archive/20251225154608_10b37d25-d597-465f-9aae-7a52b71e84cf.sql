-- Add cricbuzz_match_id column to matches table for alternative score source
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS cricbuzz_match_id text;

-- Change default of cricket_api_enabled to false (off by default)
ALTER TABLE public.site_settings ALTER COLUMN cricket_api_enabled SET DEFAULT false;

-- Also set api_score_enabled on matches to default false
ALTER TABLE public.matches ALTER COLUMN api_score_enabled SET DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.matches.cricbuzz_match_id IS 'Cricbuzz match ID for fetching live scores from Cricbuzz as alternative to CricAPI';