
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS crex_match_fkey text;

-- Allow 'crex' as a valid playing_xi_auto_sync_source value
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass::text AS tbl
    FROM pg_constraint
    WHERE conname LIKE '%playing_xi_auto_sync_source%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

ALTER TABLE public.site_settings
  ADD CONSTRAINT site_settings_playing_xi_auto_sync_source_check
  CHECK (playing_xi_auto_sync_source IN ('api_cricket','espn','sofascore','crex'));

ALTER TABLE public.site_settings_public
  ADD CONSTRAINT site_settings_public_playing_xi_auto_sync_source_check
  CHECK (playing_xi_auto_sync_source IN ('api_cricket','espn','sofascore','crex'));
