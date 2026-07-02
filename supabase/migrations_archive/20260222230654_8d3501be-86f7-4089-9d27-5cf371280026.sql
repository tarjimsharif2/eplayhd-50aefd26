
-- Drop the existing unique constraint on (tournament_id, team_id)
ALTER TABLE public.tournament_points_table DROP CONSTRAINT IF EXISTS tournament_points_table_tournament_id_team_id_key;

-- Add new unique constraint on (tournament_id, team_id, group_name)
CREATE UNIQUE INDEX tournament_points_table_tournament_team_group_key 
ON public.tournament_points_table (tournament_id, team_id, COALESCE(group_name, '__none__'));
