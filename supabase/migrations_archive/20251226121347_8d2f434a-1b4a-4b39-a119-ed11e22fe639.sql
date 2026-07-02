-- Add match_end_time column for alternative to match_duration_minutes
ALTER TABLE public.matches 
ADD COLUMN match_end_time timestamp with time zone DEFAULT NULL;