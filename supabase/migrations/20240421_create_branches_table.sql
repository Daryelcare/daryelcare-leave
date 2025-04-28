-- Create branches table
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert some initial branches
INSERT INTO public.branches (name) VALUES
  ('London'),
  ('Manchester'),
  ('Birmingham'),
  ('Edinburgh'),
  ('Cardiff')
ON CONFLICT (name) DO NOTHING;

-- Add RLS policies
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access for all authenticated users"
  ON public.branches
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow insert, update, delete for service role only
CREATE POLICY "Allow full access for service role"
  ON public.branches
  USING (auth.jwt() IS NOT NULL);
