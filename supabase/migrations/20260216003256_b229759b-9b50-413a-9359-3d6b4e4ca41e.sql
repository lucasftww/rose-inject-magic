
-- Allow authenticated users to read any profile's username (needed for reviews)
CREATE POLICY "Anyone can view profile username"
ON public.profiles
FOR SELECT
USING (true);

-- Drop the old restrictive select policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
