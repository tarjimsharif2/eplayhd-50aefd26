-- Add result_margin column to store winning margin text like "by 7 wickets"
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS result_margin TEXT;