-- Add ad_block_rules column to site_settings table
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS ad_block_rules JSONB DEFAULT '{"cssSelectors": [".ad", ".ads", ".advert", ".advertisement", ".ad-container", ".ad-wrapper", ".banner-ad", ".top-ad", ".bottom-ad", ".sidebar-ad", ".popup", ".popunder", ".overlay-ad", ".interstitial", ".sticky-ad", ".fixed-ad", ".floating-ad", ".modal-backdrop", ".modal-overlay"], "blockPopups": true, "blockNewTabs": true}'::jsonb;

-- Add ad_block_rules column to site_settings_public table
ALTER TABLE public.site_settings_public 
ADD COLUMN IF NOT EXISTS ad_block_rules JSONB DEFAULT '{"cssSelectors": [".ad", ".ads", ".advert", ".advertisement", ".ad-container", ".ad-wrapper", ".banner-ad", ".top-ad", ".bottom-ad", ".sidebar-ad", ".popup", ".popunder", ".overlay-ad", ".interstitial", ".sticky-ad", ".fixed-ad", ".floating-ad", ".modal-backdrop", ".modal-overlay"], "blockPopups": true, "blockNewTabs": true}'::jsonb;