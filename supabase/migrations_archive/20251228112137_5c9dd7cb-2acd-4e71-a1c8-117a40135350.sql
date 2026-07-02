-- Add api-cricket.com settings columns to site_settings table
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS api_cricket_key text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS api_cricket_enabled boolean DEFAULT false;

-- Add to site_settings_public table
ALTER TABLE public.site_settings_public 
ADD COLUMN IF NOT EXISTS api_cricket_enabled boolean DEFAULT false;

-- Update the trigger function to sync the new column
CREATE OR REPLACE FUNCTION public.sync_site_settings_public_from_site_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    ads_txt_content,
    custom_header_code,
    custom_footer_code,
    match_page_ad_positions,
    api_cricket_enabled
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
    NEW.ads_txt_content,
    NEW.custom_header_code,
    NEW.custom_footer_code,
    NEW.match_page_ad_positions,
    NEW.api_cricket_enabled
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
    ads_txt_content = EXCLUDED.ads_txt_content,
    custom_header_code = EXCLUDED.custom_header_code,
    custom_footer_code = EXCLUDED.custom_footer_code,
    match_page_ad_positions = EXCLUDED.match_page_ad_positions,
    api_cricket_enabled = EXCLUDED.api_cricket_enabled;

  RETURN NEW;
END;
$function$;