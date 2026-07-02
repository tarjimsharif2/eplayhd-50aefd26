-- Create match_substitutions table for football substitution tracking
CREATE TABLE public.match_substitutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_out TEXT NOT NULL,
  player_in TEXT NOT NULL,
  minute TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.match_substitutions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Substitutions are viewable by everyone" 
ON public.match_substitutions 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert substitutions" 
ON public.match_substitutions 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update substitutions" 
ON public.match_substitutions 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete substitutions" 
ON public.match_substitutions 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create updated_at trigger
CREATE TRIGGER update_match_substitutions_updated_at
BEFORE UPDATE ON public.match_substitutions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_substitutions;