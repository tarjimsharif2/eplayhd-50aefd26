-- Add ad_block_enabled column to streaming_servers table
ALTER TABLE public.streaming_servers 
ADD COLUMN ad_block_enabled boolean DEFAULT false;