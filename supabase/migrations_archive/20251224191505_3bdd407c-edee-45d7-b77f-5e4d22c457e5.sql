-- Add timing fields for automated STUMPS management
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS stumps_time TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS day_start_time TIME DEFAULT NULL,
ADD COLUMN IF NOT EXISTS next_day_start TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add comments for clarity
COMMENT ON COLUMN public.matches.stumps_time IS 'Timestamp when stumps was called for current day';
COMMENT ON COLUMN public.matches.day_start_time IS 'Default daily start time for Test matches (e.g., 10:00 AM local)';
COMMENT ON COLUMN public.matches.next_day_start IS 'Next scheduled start time for play to resume';

-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;