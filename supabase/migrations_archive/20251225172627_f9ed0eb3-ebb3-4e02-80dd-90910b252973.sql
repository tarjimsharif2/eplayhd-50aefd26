-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to call fetch-match-result edge function when match becomes completed
CREATE OR REPLACE FUNCTION public.auto_fetch_match_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_response_id bigint;
BEGIN
  -- Only trigger when status changes to 'completed' and api_score_enabled is true and has cricbuzz_match_id
  IF NEW.status = 'completed' 
     AND (OLD.status IS NULL OR OLD.status != 'completed')
     AND NEW.api_score_enabled = true 
     AND NEW.cricbuzz_match_id IS NOT NULL THEN
    
    -- Call the edge function via HTTP
    SELECT extensions.http_post(
      url := 'https://doqteforumjdugifxryl.supabase.co/functions/v1/fetch-match-result',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcXRlZm9ydW1qZHVnaWZ4cnlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NDY5NjQsImV4cCI6MjA4MjEyMjk2NH0.TzRAPhPWC6WN_IR24qEWA8TznqlrqPirJBdDmWyT9n8'
      ),
      body := jsonb_build_object(
        'matchId', NEW.id,
        'cricbuzzMatchId', NEW.cricbuzz_match_id
      )
    ) INTO v_response_id;
    
    RAISE LOG 'Auto-fetch match result triggered for match %, response_id: %', NEW.id, v_response_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-fetch result when match status changes to completed
DROP TRIGGER IF EXISTS trigger_auto_fetch_match_result ON public.matches;
CREATE TRIGGER trigger_auto_fetch_match_result
  AFTER UPDATE OF status ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fetch_match_result();