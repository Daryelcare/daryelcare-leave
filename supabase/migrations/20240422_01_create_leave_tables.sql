-- First, create the tables
CREATE TABLE IF NOT EXISTS public.leave_allocation_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.leave_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES public.leave_allocation_periods(id) ON DELETE CASCADE,
  allocation_days INTEGER NOT NULL DEFAULT 28,
  used_days INTEGER NOT NULL DEFAULT 0,
  remaining_days INTEGER NOT NULL DEFAULT 28,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id, period_id)
);

-- Add trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leave_allocations_updated_at
BEFORE UPDATE ON public.leave_allocations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Insert initial leave period (2025-2026)
INSERT INTO public.leave_allocation_periods (start_date, end_date, is_active)
VALUES ('2025-04-01', '2026-03-31', true);

-- Add RLS policies
ALTER TABLE public.leave_allocation_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_allocations ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access for all authenticated users"
ON public.leave_allocation_periods
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow read access for all authenticated users"
ON public.leave_allocations
FOR SELECT
TO authenticated
USING (true);

-- Allow insert, update, delete for service role only
CREATE POLICY "Allow full access for service role"
ON public.leave_allocation_periods
USING (auth.jwt() IS NOT NULL);

CREATE POLICY "Allow full access for service role"
ON public.leave_allocations
USING (auth.jwt() IS NOT NULL);
