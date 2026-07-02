-- Add football goal details columns to matches table
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS goals_team_a jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS goals_team_b jsonb DEFAULT '[]'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.matches.goals_team_a IS 'Array of goal events for team A: [{player, minute, assist?, type}]';
COMMENT ON COLUMN public.matches.goals_team_b IS 'Array of goal events for team B: [{player, minute, assist?, type}]';