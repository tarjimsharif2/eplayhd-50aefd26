-- Create dynamic pages table for DMCA, Contact, and other custom pages
CREATE TABLE public.dynamic_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT,
  content_type TEXT NOT NULL DEFAULT 'html', -- 'html' or 'text'
  is_active BOOLEAN DEFAULT true,
  show_in_header BOOLEAN DEFAULT false,
  show_in_footer BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  og_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dynamic_pages ENABLE ROW LEVEL SECURITY;

-- Public can view active pages
CREATE POLICY "Active pages are viewable by everyone" 
ON public.dynamic_pages 
FOR SELECT 
USING (is_active = true);

-- Admins can manage all pages
CREATE POLICY "Admins can insert pages" 
ON public.dynamic_pages 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update pages" 
ON public.dynamic_pages 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pages" 
ON public.dynamic_pages 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_dynamic_pages_updated_at
BEFORE UPDATE ON public.dynamic_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add new columns to site_settings for custom header/footer code and ad positions
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS custom_header_code TEXT,
ADD COLUMN IF NOT EXISTS custom_footer_code TEXT,
ADD COLUMN IF NOT EXISTS match_page_ad_positions JSONB DEFAULT '{"before_player": true, "after_player": true, "sidebar": true, "below_info": true}'::jsonb;

-- Add same columns to site_settings_public
ALTER TABLE public.site_settings_public 
ADD COLUMN IF NOT EXISTS custom_header_code TEXT,
ADD COLUMN IF NOT EXISTS custom_footer_code TEXT,
ADD COLUMN IF NOT EXISTS match_page_ad_positions JSONB DEFAULT '{"before_player": true, "after_player": true, "sidebar": true, "below_info": true}'::jsonb;

-- Update the sync function to include new columns
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
    match_page_ad_positions
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
    NEW.match_page_ad_positions
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
    match_page_ad_positions = EXCLUDED.match_page_ad_positions;

  RETURN NEW;
END;
$function$;

-- Insert default pages (DMCA and Contact Us)
INSERT INTO public.dynamic_pages (slug, title, content, content_type, show_in_header, show_in_footer, display_order, seo_title, seo_description)
VALUES 
  ('dmca', 'DMCA', '<h1>DMCA Policy</h1><p>This is a placeholder for your DMCA policy. Please edit this content from the admin panel.</p>', 'html', true, true, 1, 'DMCA Policy', 'DMCA takedown policy and copyright information'),
  ('contact-us', 'Contact Us', '<h1>Contact Us</h1><p>This is a placeholder for your contact information. Please edit this content from the admin panel.</p>', 'html', true, true, 2, 'Contact Us', 'Get in touch with us')
ON CONFLICT (slug) DO NOTHING;