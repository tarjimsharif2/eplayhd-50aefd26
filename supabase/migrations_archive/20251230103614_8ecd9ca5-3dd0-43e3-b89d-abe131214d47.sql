-- Drop the existing status check constraint and add a new one with more status options
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;

-- Add new check constraint with all possible status values
ALTER TABLE public.matches ADD CONSTRAINT matches_status_check 
CHECK (status IN ('upcoming', 'live', 'completed', 'cancelled', 'abandoned', 'postponed', 'delayed', 'interrupted'));