ALTER TABLE public.streaming_json_sources
ADD COLUMN IF NOT EXISTS use_entry_name boolean NOT NULL DEFAULT false;