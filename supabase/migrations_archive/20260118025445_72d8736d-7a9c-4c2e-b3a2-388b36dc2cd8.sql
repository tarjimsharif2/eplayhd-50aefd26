-- Add new columns to banners table for match/tournament linking
ALTER TABLE public.banners 
  ADD COLUMN IF NOT EXISTS banner_type text DEFAULT 'custom' CHECK (banner_type IN ('match', 'tournament', 'custom')),
  ADD COLUMN IF NOT EXISTS match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tournament_id uuid REFERENCES public.tournaments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS badge_type text DEFAULT 'none' CHECK (badge_type IN ('none', 'live', 'upcoming', 'watch_now'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_banners_match_id ON public.banners(match_id);
CREATE INDEX IF NOT EXISTS idx_banners_tournament_id ON public.banners(tournament_id);

COMMENT ON COLUMN public.banners.banner_type IS 'Type of banner: match, tournament, or custom link';
COMMENT ON COLUMN public.banners.badge_type IS 'Status badge to show: none, live, upcoming, watch_now';