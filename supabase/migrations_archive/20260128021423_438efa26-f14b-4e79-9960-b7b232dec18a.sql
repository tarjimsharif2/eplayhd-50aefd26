-- Create football_leagues table for caching ESPN leagues
CREATE TABLE public.football_leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_code TEXT UNIQUE NOT NULL,
  league_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.football_leagues ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Football leagues viewable by everyone" 
ON public.football_leagues 
FOR SELECT 
USING (true);

-- Admin management
CREATE POLICY "Admins can manage football leagues" 
ON public.football_leagues 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Service role access for edge function
CREATE POLICY "Service role can manage football leagues" 
ON public.football_leagues 
FOR ALL 
USING (true)
WITH CHECK (true);