-- Add streaming header parameters to streaming_servers table
ALTER TABLE public.streaming_servers
ADD COLUMN referer_value TEXT,
ADD COLUMN origin_value TEXT,
ADD COLUMN cookie_value TEXT,
ADD COLUMN user_agent TEXT;