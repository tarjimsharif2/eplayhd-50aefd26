-- Add participating teams settings to tournaments table
ALTER TABLE public.tournaments 
ADD COLUMN IF NOT EXISTS show_participating_teams boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS participating_teams_position text DEFAULT 'before_matches',
ADD COLUMN IF NOT EXISTS custom_participating_teams jsonb DEFAULT NULL;

-- Position options: 'before_matches', 'after_matches', 'after_points_table', 'before_about', 'after_about'
-- custom_participating_teams format: [{"name": "Team Name", "logo_url": "optional_url"}, ...]

COMMENT ON COLUMN public.tournaments.show_participating_teams IS 'Toggle to show/hide participating teams section';
COMMENT ON COLUMN public.tournaments.participating_teams_position IS 'Position of participating teams: before_matches, after_matches, after_points_table, before_about, after_about';
COMMENT ON COLUMN public.tournaments.custom_participating_teams IS 'Custom list of participating teams with name and optional logo_url';