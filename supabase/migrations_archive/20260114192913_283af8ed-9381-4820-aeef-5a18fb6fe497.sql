-- Add show_in_homepage column to tournaments table for hiding from homepage list
ALTER TABLE public.tournaments 
ADD COLUMN IF NOT EXISTS show_in_homepage BOOLEAN DEFAULT true;