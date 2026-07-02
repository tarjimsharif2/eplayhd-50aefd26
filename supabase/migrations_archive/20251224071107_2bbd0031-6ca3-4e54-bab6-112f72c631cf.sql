-- Create teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tournaments table
CREATE TABLE public.tournaments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sport TEXT NOT NULL DEFAULT 'Cricket',
  season TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create matches table
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_a_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  team_b_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  match_number INTEGER NOT NULL DEFAULT 1,
  match_date TEXT NOT NULL,
  match_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed')),
  venue TEXT,
  score_a TEXT,
  score_b TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table for admins
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Teams policies (public read, admin write)
CREATE POLICY "Teams are viewable by everyone" 
  ON public.teams FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can insert teams" 
  ON public.teams FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update teams" 
  ON public.teams FOR UPDATE 
  TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can delete teams" 
  ON public.teams FOR DELETE 
  TO authenticated 
  USING (true);

-- Tournaments policies (public read, admin write)
CREATE POLICY "Tournaments are viewable by everyone" 
  ON public.tournaments FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can insert tournaments" 
  ON public.tournaments FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tournaments" 
  ON public.tournaments FOR UPDATE 
  TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can delete tournaments" 
  ON public.tournaments FOR DELETE 
  TO authenticated 
  USING (true);

-- Matches policies (public read, admin write)
CREATE POLICY "Matches are viewable by everyone" 
  ON public.matches FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can insert matches" 
  ON public.matches FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update matches" 
  ON public.matches FOR UPDATE 
  TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can delete matches" 
  ON public.matches FOR DELETE 
  TO authenticated 
  USING (true);

-- Profiles policies
CREATE POLICY "Profiles are viewable by owner" 
  ON public.profiles FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" 
  ON public.profiles FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tournaments_updated_at
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_matches_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_matches_tournament_id ON public.matches(tournament_id);
CREATE INDEX idx_matches_team_a_id ON public.matches(team_a_id);
CREATE INDEX idx_matches_team_b_id ON public.matches(team_b_id);
CREATE INDEX idx_matches_status ON public.matches(status);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);