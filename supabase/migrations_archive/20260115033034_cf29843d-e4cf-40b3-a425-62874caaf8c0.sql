-- Add is_completed column to tournaments table
ALTER TABLE public.tournaments 
ADD COLUMN is_completed boolean DEFAULT false;