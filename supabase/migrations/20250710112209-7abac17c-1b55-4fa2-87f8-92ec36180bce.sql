-- Add missing fields to profiles table for profile page
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS birthdate DATE,
ADD COLUMN IF NOT EXISTS current_work_hours INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS benefits TEXT;

-- Drop and recreate the update policy to ensure users can update their profiles
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);