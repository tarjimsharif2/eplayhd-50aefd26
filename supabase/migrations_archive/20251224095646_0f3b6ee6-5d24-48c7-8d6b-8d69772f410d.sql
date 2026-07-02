-- Fix CLIENT_SIDE_AUTH: Update RLS policies to require admin role for write operations

-- Drop existing permissive policies for teams
DROP POLICY IF EXISTS "Authenticated users can delete teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can insert teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can update teams" ON public.teams;

-- Create new admin-only policies for teams
CREATE POLICY "Admins can delete teams" 
ON public.teams 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert teams" 
ON public.teams 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update teams" 
ON public.teams 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Drop existing permissive policies for tournaments
DROP POLICY IF EXISTS "Authenticated users can delete tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Authenticated users can insert tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Authenticated users can update tournaments" ON public.tournaments;

-- Create new admin-only policies for tournaments
CREATE POLICY "Admins can delete tournaments" 
ON public.tournaments 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert tournaments" 
ON public.tournaments 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update tournaments" 
ON public.tournaments 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Drop existing permissive policies for matches
DROP POLICY IF EXISTS "Authenticated users can delete matches" ON public.matches;
DROP POLICY IF EXISTS "Authenticated users can insert matches" ON public.matches;
DROP POLICY IF EXISTS "Authenticated users can update matches" ON public.matches;

-- Create new admin-only policies for matches
CREATE POLICY "Admins can delete matches" 
ON public.matches 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert matches" 
ON public.matches 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update matches" 
ON public.matches 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Drop existing permissive policies for sports
DROP POLICY IF EXISTS "Admins can delete sports" ON public.sports;
DROP POLICY IF EXISTS "Admins can insert sports" ON public.sports;
DROP POLICY IF EXISTS "Admins can update sports" ON public.sports;

-- Create new admin-only policies for sports with proper role checks
CREATE POLICY "Admins can delete sports" 
ON public.sports 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert sports" 
ON public.sports 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update sports" 
ON public.sports 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Drop existing permissive policies for banners
DROP POLICY IF EXISTS "Authenticated users can delete banners" ON public.banners;
DROP POLICY IF EXISTS "Authenticated users can insert banners" ON public.banners;
DROP POLICY IF EXISTS "Authenticated users can update banners" ON public.banners;

-- Create new admin-only policies for banners
CREATE POLICY "Admins can delete banners" 
ON public.banners 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert banners" 
ON public.banners 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update banners" 
ON public.banners 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Fix INPUT_VALIDATION: Add URL protocol constraint for streaming servers
ALTER TABLE public.streaming_servers 
ADD CONSTRAINT valid_url_protocol 
CHECK (server_url LIKE 'https://%' OR server_url LIKE 'http://%');