-- Replace security-definer view with a real public settings table synced from site_settings
DROP VIEW IF EXISTS public.site_settings_public;

CREATE TABLE IF NOT EXISTS public.site_settings_public (
  id uuid PRIMARY KEY,
  site_name text,
  site_title text,
  site_description text,
  site_keywords text,
  logo_url text,
  favicon_url text,
  og_image_url text,
  footer_text text,
  google_analytics_id text,
  created_at timestamptz,
  updated_at timestamptz,
  header_ad_code text,
  sidebar_ad_code text,
  footer_ad_code text,
  in_article_ad_code text,
  popup_ad_code text,
  ads_enabled boolean,
  google_adsense_id text,
  canonical_url text,
  robots_txt text,
  schema_org_enabled boolean,
  twitter_handle text,
  facebook_app_id text,
  telegram_link text,
  social_links jsonb,
  cricket_api_enabled boolean,
  ads_txt_content text
);

-- Keep it publicly readable (safe subset only)
ALTER TABLE public.site_settings_public ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public site settings are viewable by everyone" ON public.site_settings_public;
CREATE POLICY "Public site settings are viewable by everyone"
ON public.site_settings_public
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage public site settings" ON public.site_settings_public;
CREATE POLICY "Admins can manage public site settings"
ON public.site_settings_public
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Permissions (RLS still applies)
REVOKE ALL ON public.site_settings_public FROM anon, authenticated;
GRANT SELECT ON public.site_settings_public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings_public TO authenticated;

-- Initial backfill (copy all existing rows)
INSERT INTO public.site_settings_public (
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
)
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
FROM public.site_settings
ON CONFLICT (id) DO UPDATE SET
  site_name = EXCLUDED.site_name,
  site_title = EXCLUDED.site_title,
  site_description = EXCLUDED.site_description,
  site_keywords = EXCLUDED.site_keywords,
  logo_url = EXCLUDED.logo_url,
  favicon_url = EXCLUDED.favicon_url,
  og_image_url = EXCLUDED.og_image_url,
  footer_text = EXCLUDED.footer_text,
  google_analytics_id = EXCLUDED.google_analytics_id,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at,
  header_ad_code = EXCLUDED.header_ad_code,
  sidebar_ad_code = EXCLUDED.sidebar_ad_code,
  footer_ad_code = EXCLUDED.footer_ad_code,
  in_article_ad_code = EXCLUDED.in_article_ad_code,
  popup_ad_code = EXCLUDED.popup_ad_code,
  ads_enabled = EXCLUDED.ads_enabled,
  google_adsense_id = EXCLUDED.google_adsense_id,
  canonical_url = EXCLUDED.canonical_url,
  robots_txt = EXCLUDED.robots_txt,
  schema_org_enabled = EXCLUDED.schema_org_enabled,
  twitter_handle = EXCLUDED.twitter_handle,
  facebook_app_id = EXCLUDED.facebook_app_id,
  telegram_link = EXCLUDED.telegram_link,
  social_links = EXCLUDED.social_links,
  cricket_api_enabled = EXCLUDED.cricket_api_enabled,
  ads_txt_content = EXCLUDED.ads_txt_content;

-- Sync function + trigger
CREATE OR REPLACE FUNCTION public.sync_site_settings_public_from_site_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.site_settings_public (
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
  ) VALUES (
    NEW.id,
    NEW.site_name,
    NEW.site_title,
    NEW.site_description,
    NEW.site_keywords,
    NEW.logo_url,
    NEW.favicon_url,
    NEW.og_image_url,
    NEW.footer_text,
    NEW.google_analytics_id,
    NEW.created_at,
    NEW.updated_at,
    NEW.header_ad_code,
    NEW.sidebar_ad_code,
    NEW.footer_ad_code,
    NEW.in_article_ad_code,
    NEW.popup_ad_code,
    NEW.ads_enabled,
    NEW.google_adsense_id,
    NEW.canonical_url,
    NEW.robots_txt,
    NEW.schema_org_enabled,
    NEW.twitter_handle,
    NEW.facebook_app_id,
    NEW.telegram_link,
    NEW.social_links,
    NEW.cricket_api_enabled,
    NEW.ads_txt_content
  )
  ON CONFLICT (id) DO UPDATE SET
    site_name = EXCLUDED.site_name,
    site_title = EXCLUDED.site_title,
    site_description = EXCLUDED.site_description,
    site_keywords = EXCLUDED.site_keywords,
    logo_url = EXCLUDED.logo_url,
    favicon_url = EXCLUDED.favicon_url,
    og_image_url = EXCLUDED.og_image_url,
    footer_text = EXCLUDED.footer_text,
    google_analytics_id = EXCLUDED.google_analytics_id,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    header_ad_code = EXCLUDED.header_ad_code,
    sidebar_ad_code = EXCLUDED.sidebar_ad_code,
    footer_ad_code = EXCLUDED.footer_ad_code,
    in_article_ad_code = EXCLUDED.in_article_ad_code,
    popup_ad_code = EXCLUDED.popup_ad_code,
    ads_enabled = EXCLUDED.ads_enabled,
    google_adsense_id = EXCLUDED.google_adsense_id,
    canonical_url = EXCLUDED.canonical_url,
    robots_txt = EXCLUDED.robots_txt,
    schema_org_enabled = EXCLUDED.schema_org_enabled,
    twitter_handle = EXCLUDED.twitter_handle,
    facebook_app_id = EXCLUDED.facebook_app_id,
    telegram_link = EXCLUDED.telegram_link,
    social_links = EXCLUDED.social_links,
    cricket_api_enabled = EXCLUDED.cricket_api_enabled,
    ads_txt_content = EXCLUDED.ads_txt_content;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_site_settings_public_trigger ON public.site_settings;
CREATE TRIGGER sync_site_settings_public_trigger
AFTER INSERT OR UPDATE
ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.sync_site_settings_public_from_site_settings();
