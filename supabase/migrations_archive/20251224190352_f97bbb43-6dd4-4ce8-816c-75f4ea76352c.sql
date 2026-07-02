-- Add cricket-specific fields to matches table
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS match_format text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS test_day integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_stumps boolean DEFAULT false;

-- Add comments for clarity
COMMENT ON COLUMN public.matches.match_format IS 'Cricket format: Test, ODI, T20, T10, The Hundred';
COMMENT ON COLUMN public.matches.test_day IS 'Current day for Test matches (1-5)';
COMMENT ON COLUMN public.matches.is_stumps IS 'Whether stumps has been called for Test match day';