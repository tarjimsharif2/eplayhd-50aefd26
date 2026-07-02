-- Drop existing SELECT policy on profiles
DROP POLICY IF EXISTS "Profiles are viewable by owner" ON public.profiles;

-- Create new policy that allows admins to view all profiles, others view own
CREATE POLICY "Profiles viewable by owner and admins"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Also add policy for service role to manage profiles (for edge functions)
DROP POLICY IF EXISTS "Service role can manage profiles" ON public.profiles;

CREATE POLICY "Service role can manage profiles"
ON public.profiles
FOR ALL
USING (true)
WITH CHECK (true);