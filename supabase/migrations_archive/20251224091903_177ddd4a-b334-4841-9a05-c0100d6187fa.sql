-- Create site_settings table for website configuration
CREATE TABLE public.site_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_name text NOT NULL DEFAULT 'Live Sports',
  site_title text NOT NULL DEFAULT 'Live Sports - Watch Live Matches',
  site_description text DEFAULT 'Watch live sports matches online. Get live scores, schedules and streaming links for Cricket, Football, Tennis and more.',
  site_keywords text DEFAULT 'live sports, live streaming, cricket, football, tennis, live scores',
  logo_url text,
  favicon_url text,
  og_image_url text,
  footer_text text DEFAULT 'All rights reserved.',
  google_analytics_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Site settings are viewable by everyone"
ON public.site_settings FOR SELECT USING (true);

CREATE POLICY "Admins can update site settings"
ON public.site_settings FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert site settings"
ON public.site_settings FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default settings
INSERT INTO public.site_settings (site_name) VALUES ('Live Sports');

-- Create streaming_servers table for multiple streaming links per match
CREATE TABLE public.streaming_servers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  server_name text NOT NULL,
  server_url text NOT NULL,
  server_type text NOT NULL DEFAULT 'iframe', -- 'iframe', 'm3u8', 'embed'
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.streaming_servers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Streaming servers are viewable by everyone"
ON public.streaming_servers FOR SELECT USING (true);

CREATE POLICY "Admins can manage streaming servers"
ON public.streaming_servers FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Add new columns to matches table for SEO-friendly match pages
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS slug text UNIQUE,
ADD COLUMN IF NOT EXISTS page_type text DEFAULT 'redirect', -- 'redirect' or 'page'
ADD COLUMN IF NOT EXISTS seo_title text,
ADD COLUMN IF NOT EXISTS seo_description text;

-- Create trigger for updated_at on new tables
CREATE TRIGGER update_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_streaming_servers_updated_at
BEFORE UPDATE ON public.streaming_servers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();