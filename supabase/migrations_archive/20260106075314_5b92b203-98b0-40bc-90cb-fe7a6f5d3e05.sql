
-- Drop the admin-only SELECT policy
DROP POLICY IF EXISTS "Only admins can view streaming servers" ON public.streaming_servers;

-- Create a new policy that allows everyone to view active streaming servers (for match pages)
CREATE POLICY "Anyone can view active streaming servers" 
ON public.streaming_servers 
FOR SELECT 
USING (is_active = true);
