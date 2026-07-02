-- Enable realtime for matches table
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;

-- Enable realtime for match_innings table (for innings updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_innings;