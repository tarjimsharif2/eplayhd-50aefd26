-- Add key_id and clearkey columns for MPD/DASH ClearKey DRM support
ALTER TABLE public.streaming_servers
ADD COLUMN IF NOT EXISTS clearkey_key_id TEXT,
ADD COLUMN IF NOT EXISTS clearkey_key TEXT;