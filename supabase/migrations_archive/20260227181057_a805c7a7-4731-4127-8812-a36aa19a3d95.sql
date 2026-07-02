ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS auto_match_result_enabled boolean DEFAULT true;
ALTER TABLE site_settings_public ADD COLUMN IF NOT EXISTS auto_match_result_enabled boolean DEFAULT true;

-- Update the sync trigger to include the new column
CREATE OR REPLACE FUNCTION public.sync_site_settings_public_from_site_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.site_settings_public (
    id, site_name, site_title, site_description, site_keywords,
    logo_url, favicon_url, og_image_url, footer_text, google_analytics_id,
    created_at, updated_at, header_ad_code, sidebar_ad_code, footer_ad_code,
    in_article_ad_code, popup_ad_code, ads_enabled, google_adsense_id,
    canonical_url, robots_txt, schema_org_enabled, twitter_handle, facebook_app_id,
    telegram_link, social_links, cricket_api_enabled, ads_txt_content,
    custom_header_code, custom_footer_code, match_page_ad_positions,
    api_cricket_enabled, api_sync_interval_seconds, slider_duration_seconds,
    admin_slug, rapidapi_endpoints, maintenance_mode, maintenance_title,
    maintenance_subtitle, maintenance_description, maintenance_estimated_time,
    maintenance_show_countdown, maintenance_end_time, maintenance_contact_email,
    maintenance_social_message, disclaimer_text, show_disclaimer,
    homepage_completed_days, homepage_channels_limit, multiple_ad_codes, 
    tournament_page_ad_positions, points_table_sync_time, points_table_auto_sync_enabled,
    ad_block_rules, rapidapi_enabled, auto_match_result_enabled
  ) VALUES (
    NEW.id, NEW.site_name, NEW.site_title, NEW.site_description, NEW.site_keywords,
    NEW.logo_url, NEW.favicon_url, NEW.og_image_url, NEW.footer_text, NEW.google_analytics_id,
    NEW.created_at, NEW.updated_at, NEW.header_ad_code, NEW.sidebar_ad_code, NEW.footer_ad_code,
    NEW.in_article_ad_code, NEW.popup_ad_code, NEW.ads_enabled, NEW.google_adsense_id,
    NEW.canonical_url, NEW.robots_txt, NEW.schema_org_enabled, NEW.twitter_handle, NEW.facebook_app_id,
    NEW.telegram_link, NEW.social_links, NEW.cricket_api_enabled, NEW.ads_txt_content,
    NEW.custom_header_code, NEW.custom_footer_code, NEW.match_page_ad_positions,
    NEW.api_cricket_enabled, NEW.api_sync_interval_seconds, NEW.slider_duration_seconds,
    NEW.admin_slug, NEW.rapidapi_endpoints, NEW.maintenance_mode, NEW.maintenance_title,
    NEW.maintenance_subtitle, NEW.maintenance_description, NEW.maintenance_estimated_time,
    NEW.maintenance_show_countdown, NEW.maintenance_end_time, NEW.maintenance_contact_email,
    NEW.maintenance_social_message, NEW.disclaimer_text, NEW.show_disclaimer,
    NEW.homepage_completed_days, NEW.homepage_channels_limit, NEW.multiple_ad_codes, 
    NEW.tournament_page_ad_positions, NEW.points_table_sync_time, NEW.points_table_auto_sync_enabled,
    NEW.ad_block_rules, NEW.rapidapi_enabled, NEW.auto_match_result_enabled
  )
  ON CONFLICT (id) DO UPDATE SET
    site_name = EXCLUDED.site_name, site_title = EXCLUDED.site_title,
    site_description = EXCLUDED.site_description, site_keywords = EXCLUDED.site_keywords,
    logo_url = EXCLUDED.logo_url, favicon_url = EXCLUDED.favicon_url,
    og_image_url = EXCLUDED.og_image_url, footer_text = EXCLUDED.footer_text,
    google_analytics_id = EXCLUDED.google_analytics_id, created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at, header_ad_code = EXCLUDED.header_ad_code,
    sidebar_ad_code = EXCLUDED.sidebar_ad_code, footer_ad_code = EXCLUDED.footer_ad_code,
    in_article_ad_code = EXCLUDED.in_article_ad_code, popup_ad_code = EXCLUDED.popup_ad_code,
    ads_enabled = EXCLUDED.ads_enabled, google_adsense_id = EXCLUDED.google_adsense_id,
    canonical_url = EXCLUDED.canonical_url, robots_txt = EXCLUDED.robots_txt,
    schema_org_enabled = EXCLUDED.schema_org_enabled, twitter_handle = EXCLUDED.twitter_handle,
    facebook_app_id = EXCLUDED.facebook_app_id, telegram_link = EXCLUDED.telegram_link,
    social_links = EXCLUDED.social_links, cricket_api_enabled = EXCLUDED.cricket_api_enabled,
    ads_txt_content = EXCLUDED.ads_txt_content, custom_header_code = EXCLUDED.custom_header_code,
    custom_footer_code = EXCLUDED.custom_footer_code, match_page_ad_positions = EXCLUDED.match_page_ad_positions,
    api_cricket_enabled = EXCLUDED.api_cricket_enabled, api_sync_interval_seconds = EXCLUDED.api_sync_interval_seconds,
    slider_duration_seconds = EXCLUDED.slider_duration_seconds, admin_slug = EXCLUDED.admin_slug,
    rapidapi_endpoints = EXCLUDED.rapidapi_endpoints, maintenance_mode = EXCLUDED.maintenance_mode,
    maintenance_title = EXCLUDED.maintenance_title, maintenance_subtitle = EXCLUDED.maintenance_subtitle,
    maintenance_description = EXCLUDED.maintenance_description, maintenance_estimated_time = EXCLUDED.maintenance_estimated_time,
    maintenance_show_countdown = EXCLUDED.maintenance_show_countdown, maintenance_end_time = EXCLUDED.maintenance_end_time,
    maintenance_contact_email = EXCLUDED.maintenance_contact_email, maintenance_social_message = EXCLUDED.maintenance_social_message,
    disclaimer_text = EXCLUDED.disclaimer_text, show_disclaimer = EXCLUDED.show_disclaimer,
    homepage_completed_days = EXCLUDED.homepage_completed_days, 
    homepage_channels_limit = EXCLUDED.homepage_channels_limit,
    multiple_ad_codes = EXCLUDED.multiple_ad_codes,
    tournament_page_ad_positions = EXCLUDED.tournament_page_ad_positions,
    points_table_sync_time = EXCLUDED.points_table_sync_time,
    points_table_auto_sync_enabled = EXCLUDED.points_table_auto_sync_enabled,
    ad_block_rules = EXCLUDED.ad_block_rules,
    rapidapi_enabled = EXCLUDED.rapidapi_enabled,
    auto_match_result_enabled = EXCLUDED.auto_match_result_enabled;

  RETURN NEW;
END;
$function$;