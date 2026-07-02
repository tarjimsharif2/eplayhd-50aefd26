-- Create innings table for cricket match innings tracking
CREATE TABLE public.match_innings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  innings_number INTEGER NOT NULL CHECK (innings_number >= 1 AND innings_number <= 4),
  batting_team_id UUID NOT NULL REFERENCES public.teams(id),
  runs INTEGER DEFAULT 0,
  wickets INTEGER DEFAULT 0 CHECK (wickets >= 0 AND wickets <= 10),
  overs DECIMAL(4,1) DEFAULT 0,
  declared BOOLEAN DEFAULT false,
  is_current BOOLEAN DEFAULT false,
  extras INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(match_id, innings_number)
);

-- Enable Row Level Security
ALTER TABLE public.match_innings ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Innings are viewable by everyone" 
ON public.match_innings 
FOR SELECT 
USING (true);

-- Create policies for admin management
CREATE POLICY "Admins can insert innings" 
ON public.match_innings 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update innings" 
ON public.match_innings 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete innings" 
ON public.match_innings 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_match_innings_updated_at
BEFORE UPDATE ON public.match_innings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_match_innings_match_id ON public.match_innings(match_id);
CREATE INDEX idx_match_innings_batting_team ON public.match_innings(batting_team_id);