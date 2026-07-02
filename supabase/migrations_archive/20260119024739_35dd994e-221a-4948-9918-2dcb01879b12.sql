-- Add slider duration column to site_settings
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS slider_duration_seconds INTEGER DEFAULT 6;

-- Also add to public view
ALTER TABLE public.site_settings_public 
ADD COLUMN IF NOT EXISTS slider_duration_seconds INTEGER DEFAULT 6;