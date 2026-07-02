-- Update the cron functions to include service role authorization
CREATE OR REPLACE FUNCTION public.call_update_match_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result text;
  _service_role_key text;
BEGIN
  -- Get the service role key from vault (if available) or use a direct approach
  _service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Call the edge function via HTTP with service role authorization
  SELECT content::text INTO _result
  FROM extensions.http((
    'POST',
    'https://doqteforumjdugifxryl.supabase.co/functions/v1/update-match-status',
    ARRAY[
      extensions.http_header('Content-Type', 'application/json'),
      extensions.http_header('Authorization', 'Bearer ' || _service_role_key)
    ],
    'application/json',
    '{}'
  )::extensions.http_request);
  
  RAISE LOG 'update-match-status result: %', _result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'update-match-status error: %', SQLERRM;
END;
$$;

-- Update sync-api-scores function
CREATE OR REPLACE FUNCTION public.call_sync_api_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result text;
  _service_role_key text;
BEGIN
  _service_role_key := current_setting('app.settings.service_role_key', true);
  
  SELECT content::text INTO _result
  FROM extensions.http((
    'POST',
    'https://doqteforumjdugifxryl.supabase.co/functions/v1/sync-api-scores',
    ARRAY[
      extensions.http_header('Content-Type', 'application/json'),
      extensions.http_header('Authorization', 'Bearer ' || _service_role_key)
    ],
    'application/json',
    '{}'
  )::extensions.http_request);
  
  RAISE LOG 'sync-api-scores result: %', _result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'sync-api-scores error: %', SQLERRM;
END;
$$;