-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on cron schema to postgres
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create a function to call edge functions
CREATE OR REPLACE FUNCTION public.call_update_match_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result text;
BEGIN
  -- Call the edge function via HTTP (internal call without auth)
  SELECT content::text INTO _result
  FROM extensions.http((
    'POST',
    'https://doqteforumjdugifxryl.supabase.co/functions/v1/update-match-status',
    ARRAY[extensions.http_header('Content-Type', 'application/json')],
    'application/json',
    '{}'
  )::extensions.http_request);
  
  RAISE LOG 'update-match-status result: %', _result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'update-match-status error: %', SQLERRM;
END;
$$;

-- Create a function to call sync-api-scores
CREATE OR REPLACE FUNCTION public.call_sync_api_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result text;
BEGIN
  SELECT content::text INTO _result
  FROM extensions.http((
    'POST',
    'https://doqteforumjdugifxryl.supabase.co/functions/v1/sync-api-scores',
    ARRAY[extensions.http_header('Content-Type', 'application/json')],
    'application/json',
    '{}'
  )::extensions.http_request);
  
  RAISE LOG 'sync-api-scores result: %', _result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'sync-api-scores error: %', SQLERRM;
END;
$$;

-- Schedule update-match-status to run every minute
SELECT cron.schedule(
  'update-match-status-every-minute',
  '* * * * *',
  $$SELECT public.call_update_match_status()$$
);

-- Schedule sync-api-scores to run every minute
SELECT cron.schedule(
  'sync-api-scores-every-minute',
  '* * * * *',
  $$SELECT public.call_sync_api_scores()$$
);