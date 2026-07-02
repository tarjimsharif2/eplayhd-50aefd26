-- Create table for saved/template streaming servers
CREATE TABLE public.saved_streaming_servers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_name TEXT NOT NULL,
  server_url TEXT NOT NULL,
  server_type TEXT NOT NULL DEFAULT 'iframe',
  referer_value TEXT,
  origin_value TEXT,
  cookie_value TEXT,
  user_agent TEXT,
  drm_license_url TEXT,
  drm_scheme TEXT,
  player_type TEXT DEFAULT 'hls',
  ad_block_enabled BOOLEAN DEFAULT false,
  clearkey_key_id TEXT,
  clearkey_key TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_streaming_servers ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can manage saved streaming servers" 
ON public.saved_streaming_servers 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_saved_streaming_servers_updated_at
BEFORE UPDATE ON public.saved_streaming_servers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create simple index for text search on server_name
CREATE INDEX idx_saved_streaming_servers_name ON public.saved_streaming_servers (server_name);

-- Create index for tags search
CREATE INDEX idx_saved_streaming_servers_tags ON public.saved_streaming_servers USING GIN (tags);