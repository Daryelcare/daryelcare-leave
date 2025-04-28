-- Create a simplified leave periods table
CREATE TABLE IF NOT EXISTS public.leave_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial leave period (2025-2026)
INSERT INTO public.leave_periods (start_date, end_date, is_active)
VALUES ('2025-04-01', '2026-03-31', true)
ON CONFLICT DO NOTHING;

-- Add RLS policies
ALTER TABLE public.leave_periods ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access for all authenticated users"
ON public.leave_periods
FOR SELECT
TO authenticated
USING (true);

-- Allow insert, update, delete for service role only
CREATE POLICY "Allow full access for service role"
ON public.leave_periods
USING (auth.jwt() IS NOT NULL);

-- Create function to reset employee leave balances when a new period starts
CREATE OR REPLACE FUNCTION create_new_leave_period(start_date DATE, end_date DATE)
RETURNS UUID AS $$
DECLARE
  new_period_id UUID;
BEGIN
  -- Update current active period to inactive
  UPDATE public.leave_periods SET is_active = false WHERE is_active = true;
  
  -- Create new period
  INSERT INTO public.leave_periods (start_date, end_date, is_active)
  VALUES (start_date, end_date, true)
  RETURNING id INTO new_period_id;
  
  -- Reset all active employees' leave balances
  UPDATE public.employees
  SET 
    days_taken = 0,
    days_remaining = 28
  WHERE status = 'active';
  
  RETURN new_period_id;
END;
$$ LANGUAGE plpgsql;
