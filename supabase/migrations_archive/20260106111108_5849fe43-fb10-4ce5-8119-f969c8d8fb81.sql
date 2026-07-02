-- Enable pg_net extension and recreate functions
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Recreate cron functions using pg_net
CREATE OR REPLACE FUNCTION public.call_update_match_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://doqteforumjdugifxryl.supabase.co/functions/v1/update-match-status',
    body := '{}'::jsonb
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'update-match-status error: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.call_sync_api_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://doqteforumjdugifxryl.supabase.co/functions/v1/sync-api-scores',
    body := '{}'::jsonb
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'sync-api-scores error: %', SQLERRM;
END;
$$;