-- Create table for match playing XI (admin-managed)
CREATE TABLE public.match_playing_xi (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  player_role TEXT, -- e.g., 'Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper'
  is_captain BOOLEAN DEFAULT false,
  is_vice_captain BOOLEAN DEFAULT false,
  is_wicket_keeper BOOLEAN DEFAULT false,
  batting_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.match_playing_xi ENABLE ROW LEVEL SECURITY;

-- Create policies for playing XI
CREATE POLICY "Playing XI is viewable by everyone" 
ON public.match_playing_xi 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert playing XI" 
ON public.match_playing_xi 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update playing XI" 
ON public.match_playing_xi 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete playing XI" 
ON public.match_playing_xi 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_match_playing_xi_updated_at
BEFORE UPDATE ON public.match_playing_xi
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for tournament points table (admin-managed with full cricket stats)
CREATE TABLE public.tournament_points_table (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  played INTEGER DEFAULT 0,
  won INTEGER DEFAULT 0,
  lost INTEGER DEFAULT 0,
  tied INTEGER DEFAULT 0,
  no_result INTEGER DEFAULT 0,
  net_run_rate DECIMAL(6,3) DEFAULT 0.000,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, team_id)
);

-- Enable RLS
ALTER TABLE public.tournament_points_table ENABLE ROW LEVEL SECURITY;

-- Create policies for points table
CREATE POLICY "Points table is viewable by everyone" 
ON public.tournament_points_table 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert points table" 
ON public.tournament_points_table 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update points table" 
ON public.tournament_points_table 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete points table" 
ON public.tournament_points_table 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_tournament_points_table_updated_at
BEFORE UPDATE ON public.tournament_points_table
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add slug column to tournaments for URL routing
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Add is_active column to tournaments to track live/active tournaments
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;