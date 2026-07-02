-- Add new columns to site_settings_public table as well
ALTER TABLE public.site_settings_public 
ADD COLUMN IF NOT EXISTS tournament_page_ad_positions jsonb DEFAULT '{"before_matches": true, "after_matches": true, "sidebar": true, "before_points_table": true, "after_points_table": true}'::jsonb;

ALTER TABLE public.site_settings_public 
ADD COLUMN IF NOT EXISTS multiple_ad_codes jsonb DEFAULT '{}'::jsonb;