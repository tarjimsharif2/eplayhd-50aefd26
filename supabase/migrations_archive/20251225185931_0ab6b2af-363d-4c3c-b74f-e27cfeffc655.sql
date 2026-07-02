-- Fix security definer view by recreating with security_invoker
DROP VIEW IF EXISTS public.site_settings_public;

CREATE VIEW public.site_settings_public 
WITH (security_invoker = true) AS
SELECT 
  id, site_name, site_title, site_description, site_keywords,
  logo_url, favicon_url, og_image_url, footer_text,
  google_analytics_id, ads_enabled, schema_org_enabled,
  social_links, telegram_link, canonical_url, robots_txt,
  twitter_handle, facebook_app_id,
  header_ad_code, sidebar_ad_code, footer_ad_code,
  in_article_ad_code, popup_ad_code, google_adsense_id,
  cricket_api_enabled,
  created_at, updated_at
FROM public.site_settings;

-- Grant SELECT on public view to anon and authenticated
GRANT SELECT ON public.site_settings_public TO anon, authenticated;