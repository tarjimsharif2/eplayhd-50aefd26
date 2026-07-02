-- Add RapidAPI key column to site_settings
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS rapidapi_key text,
ADD COLUMN IF NOT EXISTS rapidapi_enabled boolean DEFAULT false;

-- Add to public view as well
ALTER TABLE public.site_settings_public 
ADD COLUMN IF NOT EXISTS rapidapi_enabled boolean DEFAULT false;