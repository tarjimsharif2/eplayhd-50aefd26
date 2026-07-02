-- Add is_active column to matches table (default true)
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;