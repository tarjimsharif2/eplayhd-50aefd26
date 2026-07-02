
-- 1. JSON sources table
CREATE TABLE IF NOT EXISTS public.streaming_json_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  last_sync_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.streaming_json_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active json sources viewable by everyone"
  ON public.streaming_json_sources FOR SELECT
  USING (true);

CREATE POLICY "Admins manage json sources"
  ON public.streaming_json_sources FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_json_sources_updated
  BEFORE UPDATE ON public.streaming_json_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Per-match toggle
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS auto_streaming_enabled BOOLEAN NOT NULL DEFAULT true;

-- 3. Streaming server origin tracking
ALTER TABLE public.streaming_servers
  ADD COLUMN IF NOT EXISTS auto_source_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS streaming_servers_auto_source_unique
  ON public.streaming_servers (match_id, auto_source_id)
  WHERE auto_source_id IS NOT NULL;

-- 4. Cron job — every 5 minutes
CREATE OR REPLACE FUNCTION public.call_sync_streaming_from_json()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://doqteforumjdugifxryl.supabase.co/functions/v1/sync-streaming-from-json',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'sync-streaming-from-json error: %', SQLERRM;
END;
$$;

DO $$ BEGIN
  PERFORM cron.unschedule('sync-streaming-from-json-every-5m');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'sync-streaming-from-json-every-5m',
  '*/5 * * * *',
  $$SELECT public.call_sync_streaming_from_json()$$
);
