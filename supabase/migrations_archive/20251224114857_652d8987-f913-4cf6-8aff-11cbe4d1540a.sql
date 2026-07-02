-- Add player_type column to streaming_servers table for M3U8 player selection
ALTER TABLE public.streaming_servers
ADD COLUMN player_type text DEFAULT 'hls' CHECK (player_type IN ('hls', 'clappr'));

COMMENT ON COLUMN public.streaming_servers.player_type IS 'Player type for M3U8 streams: hls (default) or clappr';