-- Create channels table
CREATE TABLE public.channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  logo_url TEXT,
  logo_background_color TEXT DEFAULT '#1a1a2e',
  description TEXT,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create channel_streaming_servers table
CREATE TABLE public.channel_streaming_servers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  server_name TEXT NOT NULL,
  server_url TEXT NOT NULL,
  server_type TEXT NOT NULL DEFAULT 'iframe',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  referer_value TEXT,
  origin_value TEXT,
  cookie_value TEXT,
  user_agent TEXT,
  drm_license_url TEXT,
  drm_scheme TEXT,
  player_type TEXT DEFAULT 'hls',
  clearkey_key_id TEXT,
  clearkey_key TEXT,
  ad_block_enabled BOOLEAN DEFAULT false,
  is_working BOOLEAN DEFAULT true,
  original_display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_streaming_servers ENABLE ROW LEVEL SECURITY;

-- RLS policies for channels
CREATE POLICY "Channels are viewable by everyone" 
ON public.channels 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage channels" 
ON public.channels 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for channel_streaming_servers
CREATE POLICY "Active channel servers are viewable by everyone" 
ON public.channel_streaming_servers 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage channel servers" 
ON public.channel_streaming_servers 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes
CREATE INDEX idx_channels_display_order ON public.channels(display_order);
CREATE INDEX idx_channels_slug ON public.channels(slug);
CREATE INDEX idx_channel_servers_channel_id ON public.channel_streaming_servers(channel_id);
CREATE INDEX idx_channel_servers_display_order ON public.channel_streaming_servers(display_order);

-- Create triggers for updated_at
CREATE TRIGGER update_channels_updated_at
BEFORE UPDATE ON public.channels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_channel_streaming_servers_updated_at
BEFORE UPDATE ON public.channel_streaming_servers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();