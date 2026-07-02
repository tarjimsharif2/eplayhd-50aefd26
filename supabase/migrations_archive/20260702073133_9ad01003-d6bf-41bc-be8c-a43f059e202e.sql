ALTER TABLE public.match_playing_xi 
  ADD COLUMN IF NOT EXISTS jersey_number INTEGER,
  ADD COLUMN IF NOT EXISTS formation TEXT,
  ADD COLUMN IF NOT EXISTS formation_place INTEGER;