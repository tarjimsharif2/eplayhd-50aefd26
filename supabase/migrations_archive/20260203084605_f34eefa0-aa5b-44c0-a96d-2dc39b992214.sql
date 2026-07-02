-- Add is_bench column to match_playing_xi table
ALTER TABLE public.match_playing_xi 
ADD COLUMN is_bench boolean DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.match_playing_xi.is_bench IS 'True if player is on bench (part of squad but not in Playing XI)';