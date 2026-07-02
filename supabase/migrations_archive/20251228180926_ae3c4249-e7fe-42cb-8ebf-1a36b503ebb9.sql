-- Create table to store API cricket scores synced from admin side
CREATE TABLE IF NOT EXISTS public.match_api_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  home_team TEXT,
  away_team TEXT,
  home_score TEXT,
  away_score TEXT,
  home_overs TEXT,
  away_overs TEXT,
  status TEXT,
  status_info TEXT,
  event_live BOOLEAN DEFAULT false,
  venue TEXT,
  toss TEXT,
  batsmen JSONB DEFAULT '[]'::jsonb,
  bowlers JSONB DEFAULT '[]'::jsonb,
  extras JSONB DEFAULT '[]'::jsonb,
  scorecard JSONB DEFAULT '[]'::jsonb,
  api_event_key TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(match_id)
);

-- Enable RLS
ALTER TABLE public.match_api_scores ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Match API scores are viewable by everyone" 
ON public.match_api_scores 
FOR SELECT 
USING (true);

-- Admin write access
CREATE POLICY "Admins can manage match API scores" 
ON public.match_api_scores 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Service role can manage (for edge function)
CREATE POLICY "Service role can manage match API scores" 
ON public.match_api_scores 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_match_api_scores_match_id ON public.match_api_scores(match_id);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_api_scores;

-- Create trigger for updated_at
CREATE TRIGGER update_match_api_scores_updated_at
BEFORE UPDATE ON public.match_api_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();