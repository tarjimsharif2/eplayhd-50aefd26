ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS head_coach_a TEXT,
  ADD COLUMN IF NOT EXISTS head_coach_b TEXT;