ALTER TABLE public.site_settings DROP CONSTRAINT IF EXISTS site_settings_playing_xi_auto_sync_source_check;
ALTER TABLE public.site_settings ADD CONSTRAINT site_settings_playing_xi_auto_sync_source_check CHECK (playing_xi_auto_sync_source = ANY (ARRAY['api_cricket'::text, 'espn'::text, 'sofascore'::text]));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='site_settings_public' AND column_name='playing_xi_auto_sync_source') THEN
    EXECUTE 'ALTER TABLE public.site_settings_public DROP CONSTRAINT IF EXISTS site_settings_public_playing_xi_auto_sync_source_check';
    EXECUTE 'ALTER TABLE public.site_settings_public ADD CONSTRAINT site_settings_public_playing_xi_auto_sync_source_check CHECK (playing_xi_auto_sync_source = ANY (ARRAY[''api_cricket''::text, ''espn''::text, ''sofascore''::text]))';
  END IF;
END $$;