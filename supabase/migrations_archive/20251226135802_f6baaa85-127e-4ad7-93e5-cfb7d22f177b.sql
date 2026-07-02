-- Add show_in_menu column to tournaments table
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS show_in_menu BOOLEAN DEFAULT true;

-- Update existing tournaments to show in menu by default
UPDATE public.tournaments SET show_in_menu = true WHERE show_in_menu IS NULL;