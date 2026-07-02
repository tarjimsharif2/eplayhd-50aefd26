-- Create a public view that excludes sensitive fields
CREATE OR REPLACE VIEW public.site_settings_public AS
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

-- Drop the existing public SELECT policy
DROP POLICY IF EXISTS "Site settings are viewable by everyone" ON public.site_settings;

-- Create new policy that only allows admins to SELECT full site settings
CREATE POLICY "Admins can read all site settings"
ON public.site_settings FOR SELECT
USING (has_role(auth.uid(), 'admin'));