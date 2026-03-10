-- Create security definer function to get current user role (if not exists)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view courses" ON public.courses;
DROP POLICY IF EXISTS "Instructors can create their own courses" ON public.courses;
DROP POLICY IF EXISTS "Instructors can update their own courses" ON public.courses;
DROP POLICY IF EXISTS "Instructors can delete their own courses" ON public.courses;

-- Create new policies restricting to admin and pedagogical_manager
CREATE POLICY "Anyone can view courses" 
ON public.courses 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Only admin and pedagogical_manager can create courses" 
ON public.courses 
FOR INSERT 
TO authenticated
WITH CHECK (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));

CREATE POLICY "Only admin and pedagogical_manager can update courses" 
ON public.courses 
FOR UPDATE 
TO authenticated
USING (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));

CREATE POLICY "Only admin and pedagogical_manager can delete courses" 
ON public.courses 
FOR DELETE 
TO authenticated
USING (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));