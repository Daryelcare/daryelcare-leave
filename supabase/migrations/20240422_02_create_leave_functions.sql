-- Function to create leave allocations for a new employee
CREATE OR REPLACE FUNCTION create_employee_leave_allocation()
RETURNS TRIGGER AS $$
DECLARE
  active_period_id UUID;
BEGIN
  -- Get the active leave period
  SELECT id INTO active_period_id FROM public.leave_allocation_periods WHERE is_active = true LIMIT 1;
  
  -- If there's an active period, create an allocation for the new employee
  IF active_period_id IS NOT NULL THEN
    INSERT INTO public.leave_allocations (
      employee_id, 
      period_id, 
      allocation_days, 
      used_days, 
      remaining_days
    ) VALUES (
      NEW.id, 
      active_period_id, 
      28, -- Default allocation
      0,  -- No days used initially
      28  -- Full allocation available
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create leave allocation when a new employee is added
CREATE TRIGGER create_employee_leave_allocation_trigger
AFTER INSERT ON public.employees
FOR EACH ROW
EXECUTE FUNCTION create_employee_leave_allocation();

-- Function to create the next leave period and allocations
CREATE OR REPLACE FUNCTION create_next_leave_period(start_date DATE, end_date DATE)
RETURNS UUID AS $$
DECLARE
  new_period_id UUID;
BEGIN
  -- Update current active period to inactive
  UPDATE public.leave_allocation_periods SET is_active = false WHERE is_active = true;
  
  -- Create new period
  INSERT INTO public.leave_allocation_periods (start_date, end_date, is_active)
  VALUES (start_date, end_date, true)
  RETURNING id INTO new_period_id;
  
  -- Create allocations for all active employees
  INSERT INTO public.leave_allocations (
    employee_id, 
    period_id, 
    allocation_days, 
    used_days, 
    remaining_days
  )
  SELECT 
    id, 
    new_period_id, 
    28, -- Default allocation
    0,  -- No days used initially
    28  -- Full allocation available
  FROM public.employees
  WHERE status = 'active';
  
  RETURN new_period_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update leave allocation when a leave request is approved
CREATE OR REPLACE FUNCTION update_leave_allocation_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  leave_period_id UUID;
  current_allocation public.leave_allocations%ROWTYPE;
BEGIN
  -- Only proceed if status changed to 'Approved'
  IF NEW.status = 'Approved' AND (OLD.status IS NULL OR OLD.status <> 'Approved') THEN
    -- Find the leave period that contains this leave request
    SELECT id INTO leave_period_id 
    FROM public.leave_allocation_periods 
    WHERE 
      to_date(NEW.start_date, 'DD/MM/YYYY') >= start_date AND 
      to_date(NEW.end_date, 'DD/MM/YYYY') <= end_date
    LIMIT 1;
    
    IF leave_period_id IS NOT NULL THEN
      -- Get current allocation
      SELECT * INTO current_allocation 
      FROM public.leave_allocations 
      WHERE employee_id = NEW.employee_id AND period_id = leave_period_id;
      
      IF FOUND THEN
        -- Update allocation
        UPDATE public.leave_allocations 
        SET 
          used_days = used_days + NEW.duration,
          remaining_days = allocation_days - (used_days + NEW.duration)
        WHERE id = current_allocation.id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update leave allocation when a leave request is approved
CREATE TRIGGER update_leave_allocation_on_approval_trigger
AFTER UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION update_leave_allocation_on_approval();
