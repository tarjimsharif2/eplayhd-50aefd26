-- Simplify cron functions - just make HTTP call without auth (anon key will be used by default)
CREATE OR REPLACE FUNCTION public.call_update_match_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result text;
BEGIN
  -- Call the edge function via HTTP (will use anon key automatically)
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