-- Add unique constraint on team name (exact match only) to prevent true duplicates
-- This allows "Manchester United" and "Manchester United Women" as separate teams
ALTER TABLE public.teams ADD CONSTRAINT teams_name_unique UNIQUE (name);