-- Drop and recreate the view with security_invoker = off so anonymous users can read it
DROP VIEW IF EXISTS public.site_settings_public;

CREATE OR REPLACE VIEW public.site_settings_public WITH (security_invoker = off) AS
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
FROM public.site_settings;

-- Grant select permission to anonymous and authenticated users
GRANT SELECT ON public.site_settings_public TO anon;
GRANT SELECT ON public.site_settings_public TO authenticated;