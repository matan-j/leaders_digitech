-- Create security definer function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Enable RLS on courses table
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view courses
CREATE POLICY "Anyone can view courses" 
ON public.courses 
FOR SELECT 
TO authenticated
USING (true);

-- Only admin and pedagogical_manager can create courses
CREATE POLICY "Only admin and pedagogical_manager can create courses" 
ON public.courses 
FOR INSERT 
TO authenticated
WITH CHECK (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));

-- Only admin and pedagogical_manager can update courses
CREATE POLICY "Only admin and pedagogical_manager can update courses" 
ON public.courses 
FOR UPDATE 
TO authenticated
USING (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));

-- Only admin and pedagogical_manager can delete courses
CREATE POLICY "Only admin and pedagogical_manager can delete courses" 
ON public.courses 
FOR DELETE 
TO authenticated
USING (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));