-- Allow null values in match_number column
ALTER TABLE public.matches 
ALTER COLUMN match_number DROP NOT NULL;