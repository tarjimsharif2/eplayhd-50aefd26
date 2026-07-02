-- Add notes column to saved_streaming_servers table for tournament/channel info
ALTER TABLE public.saved_streaming_servers 
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;