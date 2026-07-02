-- Create table to track sitemap ping history
CREATE TABLE public.sitemap_ping_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ping_type TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'auto_match', 'auto_tournament', 'auto_page'
  triggered_by TEXT, -- match_id, tournament_id, page_id, or 'manual'
  sitemap_url TEXT NOT NULL,
  results JSONB DEFAULT '[]'::jsonb,
  success_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sitemap_ping_history ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read ping history
CREATE POLICY "Ping history is viewable by everyone"
ON public.sitemap_ping_history
FOR SELECT
USING (true);

-- Admins can manage ping history
CREATE POLICY "Admins can manage ping history"
ON public.sitemap_ping_history
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Service role can manage ping history (for edge functions)
CREATE POLICY "Service role can manage ping history"
ON public.sitemap_ping_history
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_sitemap_ping_history_created_at ON public.sitemap_ping_history(created_at DESC);
CREATE INDEX idx_sitemap_ping_history_ping_type ON public.sitemap_ping_history(ping_type);