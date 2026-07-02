-- Add group_name column to tournament_points_table for group-based tournaments
ALTER TABLE public.tournament_points_table 
ADD COLUMN group_name text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.tournament_points_table.group_name IS 'Group name for group-stage tournaments (e.g., Group A, Group B)';