-- Add missing fields to profiles table for profile page
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS birthdate DATE,
ADD COLUMN IF NOT EXISTS current_work_hours INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS benefits TEXT;

-- Update RLS policies to allow users to update their own profile
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);