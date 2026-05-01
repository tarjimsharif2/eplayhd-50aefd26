
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS sofascore_event_id TEXT;
ALTER TABLE public.match_playing_xi ADD COLUMN IF NOT EXISTS sofascore_player_id TEXT;
