-- Add change_status column to track player IN/OUT status compared to last match
ALTER TABLE public.match_playing_xi 
ADD COLUMN IF NOT EXISTS change_status text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.match_playing_xi.change_status IS 'Indicates if player is new (in) or dropped (out) compared to last match. Values: in, out, null (unchanged)';