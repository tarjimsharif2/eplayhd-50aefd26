-- Add logo background color column to tournaments table
ALTER TABLE public.tournaments 
ADD COLUMN logo_background_color text DEFAULT '#1a1a2e';

-- Update the site_settings_public sync trigger to include this field if needed
COMMENT ON COLUMN public.tournaments.logo_background_color IS 'Custom background color for tournament logo display on match cards';