-- Add ads.txt content column to site_settings
ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS ads_txt_content text DEFAULT NULL;