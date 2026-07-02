-- Add per-tournament points table sync time
ALTER TABLE public.tournaments 
ADD COLUMN IF NOT EXISTS points_table_sync_time text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.tournaments.points_table_sync_time IS 'Per-tournament auto-sync time in ISO format with timezone offset, e.g. 03:00+06:00';
