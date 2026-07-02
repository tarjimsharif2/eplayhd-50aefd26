
-- Bottom navigation items
CREATE TABLE public.bottom_nav_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  icon_name TEXT NOT NULL DEFAULT 'Home',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bottom_nav_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bottom_nav_items TO authenticated;
GRANT ALL ON public.bottom_nav_items TO service_role;

ALTER TABLE public.bottom_nav_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bottom nav readable by all"
ON public.bottom_nav_items FOR SELECT
USING (true);

CREATE POLICY "Admins manage bottom nav"
ON public.bottom_nav_items FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_bottom_nav_items_updated
BEFORE UPDATE ON public.bottom_nav_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.bottom_nav_items (label, url, icon_name, display_order) VALUES
('Home', '/', 'Tv', 1),
('Live', '/?filter=live', 'Radio', 2),
('Channels', '/channels', 'LayoutGrid', 3),
('Tournament', '/?section=tournaments', 'Trophy', 4);

-- Auto-complete expired tournaments
CREATE OR REPLACE FUNCTION public.auto_complete_expired_tournaments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tournaments
  SET is_completed = true,
      updated_at = now()
  WHERE end_date IS NOT NULL
    AND end_date < CURRENT_DATE
    AND (is_completed IS NULL OR is_completed = false);
END;
$$;

-- Schedule daily at 00:05 UTC via pg_cron if available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('auto-complete-expired-tournaments')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-complete-expired-tournaments');
    PERFORM cron.schedule(
      'auto-complete-expired-tournaments',
      '5 0 * * *',
      $cron$ SELECT public.auto_complete_expired_tournaments(); $cron$
    );
  END IF;
END $$;

-- Run once immediately to backfill
SELECT public.auto_complete_expired_tournaments();
