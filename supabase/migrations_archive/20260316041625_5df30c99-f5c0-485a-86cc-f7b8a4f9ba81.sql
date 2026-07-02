
CREATE TABLE public.tournament_venues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  venue_name TEXT NOT NULL,
  city TEXT,
  country TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tournament venues are viewable by everyone"
  ON public.tournament_venues FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage tournament venues"
  ON public.tournament_venues FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
