-- Add total_teams and total_venues columns to tournaments table
ALTER TABLE public.tournaments
ADD COLUMN total_teams INTEGER DEFAULT NULL,
ADD COLUMN total_venues INTEGER DEFAULT NULL;