-- Add ad settings and additional SEO fields to site_settings
ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS header_ad_code text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sidebar_ad_code text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS footer_ad_code text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS in_article_ad_code text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS popup_ad_code text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ads_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS google_adsense_id text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS canonical_url text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS robots_txt text DEFAULT 'User-agent: *\nAllow: /',
ADD COLUMN IF NOT EXISTS schema_org_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS twitter_handle text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS facebook_app_id text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS telegram_link text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}';

-- Add SEO keywords field to matches table for per-match keywords
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS seo_keywords text DEFAULT NULL;