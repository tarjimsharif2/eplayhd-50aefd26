-- Change match_number from integer to text to allow custom values like "Round 7"
ALTER TABLE public.matches 
ALTER COLUMN match_number TYPE text USING match_number::text;

-- Update default value to null
ALTER TABLE public.matches 
ALTER COLUMN match_number SET DEFAULT NULL;