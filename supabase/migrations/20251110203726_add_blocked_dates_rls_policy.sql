-- Enable RLS on blocked_dates table
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read blocked dates
CREATE POLICY "Allow authenticated users to read blocked dates"
ON blocked_dates
FOR SELECT
TO authenticated
USING (true);

-- Allow admins to insert/update/delete blocked dates
CREATE POLICY "Allow admins to manage blocked dates"
ON blocked_dates
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
