
-- Add cricapi_match_id column to matches table
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS cricapi_match_id text DEFAULT NULL;

-- Add index for cricapi_match_id lookups
CREATE INDEX IF NOT EXISTS idx_matches_cricapi_match_id ON public.matches(cricapi_match_id) WHERE cricapi_match_id IS NOT NULL;
