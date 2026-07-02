-- Add logo_background_color column to teams table
ALTER TABLE public.teams 
ADD COLUMN logo_background_color text DEFAULT '#1a1a2e';