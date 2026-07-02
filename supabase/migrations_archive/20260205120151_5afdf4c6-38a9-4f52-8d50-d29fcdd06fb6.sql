-- Add manual toss columns to matches table
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS toss_winner_id UUID REFERENCES public.teams(id),
ADD COLUMN IF NOT EXISTS toss_decision TEXT CHECK (toss_decision IN ('bat', 'bowl'));

-- Add index for toss queries
CREATE INDEX IF NOT EXISTS idx_matches_toss_winner ON public.matches(toss_winner_id) WHERE toss_winner_id IS NOT NULL;