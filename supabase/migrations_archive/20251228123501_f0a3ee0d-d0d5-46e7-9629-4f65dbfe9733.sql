-- Add auto-sync columns to matches table
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS auto_sync_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_api_sync timestamp with time zone;

-- Add comment for clarity
COMMENT ON COLUMN public.matches.auto_sync_enabled IS 'Whether this match should be auto-synced by admin panel';
COMMENT ON COLUMN public.matches.last_api_sync IS 'Last time this match was synced from the API';