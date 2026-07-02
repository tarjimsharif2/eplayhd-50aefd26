
ALTER TABLE public.streaming_json_sources
  ADD COLUMN IF NOT EXISTS url_field text NOT NULL DEFAULT 'playerUrl',
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_streaming_json_sources_order
  ON public.streaming_json_sources (display_order, created_at);
