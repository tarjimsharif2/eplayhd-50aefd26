-- Add show_playing_xi column to matches table
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS show_playing_xi BOOLEAN DEFAULT false;