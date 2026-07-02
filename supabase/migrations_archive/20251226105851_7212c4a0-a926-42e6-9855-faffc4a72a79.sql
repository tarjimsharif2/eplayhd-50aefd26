-- Drop and recreate the public view to include ads_txt_content
DROP VIEW IF EXISTS public.site_settings_public;

CREATE VIEW public.site_settings_public AS
SELECT 
  id,
  site_name,
  site_title,
  site_description,
  site_keywords,
  logo_url,
  favicon_url,
  og_image_url,
  footer_text,
  google_analytics_id,
  created_at,
  updated_at,
  header_ad_code,
  sidebar_ad_code,
  footer_ad_code,
  in_article_ad_code,
  popup_ad_code,
  ads_enabled,
  google_adsense_id,
  canonical_url,
  robots_txt,
  schema_org_enabled,
  twitter_handle,
  facebook_app_id,
  telegram_link,
  social_links,
  cricket_api_enabled,
  ads_txt_content
FROM site_settings;