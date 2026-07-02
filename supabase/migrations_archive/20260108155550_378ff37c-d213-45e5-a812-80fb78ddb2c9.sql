-- Add series_id column to tournaments table for storing Cricbuzz series ID
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS series_id text;

-- Comment for the column
COMMENT ON COLUMN public.tournaments.series_id IS 'Cricbuzz series ID for API sync';