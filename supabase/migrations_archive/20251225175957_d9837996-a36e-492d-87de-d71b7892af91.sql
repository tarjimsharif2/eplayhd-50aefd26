-- Drop the trigger first, then the function
DROP TRIGGER IF EXISTS trigger_auto_fetch_match_result ON matches;
DROP FUNCTION IF EXISTS public.auto_fetch_match_result() CASCADE;