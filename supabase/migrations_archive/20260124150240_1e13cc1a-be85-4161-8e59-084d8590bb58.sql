-- Add admin_slug to site_settings
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS admin_slug text DEFAULT 'admin';
ALTER TABLE public.site_settings_public ADD COLUMN IF NOT EXISTS admin_slug text DEFAULT 'admin';

-- Update sync function to include admin_slug
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
    api_cricket_enabled,
    api_sync_interval_seconds,
    slider_duration_seconds,
    admin_slug
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
    NEW.api_cricket_enabled,
    NEW.api_sync_interval_seconds,
    NEW.slider_duration_seconds,
    NEW.admin_slug
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
    api_cricket_enabled = EXCLUDED.api_cricket_enabled,
    api_sync_interval_seconds = EXCLUDED.api_sync_interval_seconds,
    slider_duration_seconds = EXCLUDED.slider_duration_seconds,
    admin_slug = EXCLUDED.admin_slug;

  RETURN NEW;
END;
$function$;

-- Create role_permissions table for granular permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(role, permission)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for role_permissions
CREATE POLICY "Role permissions are viewable by authenticated users"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only super admins can manage role permissions"
ON public.role_permissions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create user_permissions table for custom user-specific permissions override
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_permissions
CREATE POLICY "Users can view their own permissions"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can manage user permissions"
ON public.user_permissions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default permissions for roles
INSERT INTO public.role_permissions (role, permission) VALUES
  -- Admin has all permissions
  ('admin', 'manage_matches'),
  ('admin', 'manage_teams'),
  ('admin', 'manage_tournaments'),
  ('admin', 'manage_banners'),
  ('admin', 'manage_streaming'),
  ('admin', 'manage_settings'),
  ('admin', 'manage_users'),
  ('admin', 'manage_pages'),
  ('admin', 'manage_points_table'),
  ('admin', 'view_analytics'),
  -- Moderator has limited permissions
  ('moderator', 'manage_matches'),
  ('moderator', 'manage_teams'),
  ('moderator', 'manage_streaming'),
  ('moderator', 'manage_banners'),
  -- User role (if needed)
  ('user', 'view_analytics')
ON CONFLICT (role, permission) DO NOTHING;

-- Function to check if user has a specific permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check user-specific permission override (granted = true)
    SELECT 1 FROM public.user_permissions
    WHERE user_id = _user_id AND permission = _permission AND granted = true
  )
  OR (
    -- Check role-based permission (if no user-specific denial)
    NOT EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = _user_id AND permission = _permission AND granted = false
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON ur.role = rp.role
      WHERE ur.user_id = _user_id AND rp.permission = _permission
    )
  )
$$;

-- Allow admins to manage user_roles
CREATE POLICY "Admins can insert user roles"
ON public.user_roles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update user roles"
ON public.user_roles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete user roles"
ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));