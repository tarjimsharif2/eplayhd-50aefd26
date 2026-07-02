-- Add homepage_channels_limit to site_settings
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS homepage_channels_limit integer DEFAULT 8;

-- Add homepage_channels_limit to site_settings_public
ALTER TABLE public.site_settings_public 
ADD COLUMN IF NOT EXISTS homepage_channels_limit integer DEFAULT 8;