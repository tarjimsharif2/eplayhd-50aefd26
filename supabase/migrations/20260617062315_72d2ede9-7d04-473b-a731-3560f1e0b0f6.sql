
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS lineup_announced BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.streaming_json_sources
  ADD COLUMN IF NOT EXISTS backup_of_source_id UUID NULL REFERENCES public.streaming_json_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sync_interval_minutes INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS last_sync_attempted_at TIMESTAMPTZ NULL;

ALTER TABLE public.streaming_servers
  ADD COLUMN IF NOT EXISTS backup_locked BOOLEAN NOT NULL DEFAULT false;
