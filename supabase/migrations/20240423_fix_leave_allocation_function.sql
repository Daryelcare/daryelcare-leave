-- Improved function to update leave allocation when a leave request is approved
CREATE OR REPLACE FUNCTION update_leave_allocation_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  leave_period_id UUID;
  current_allocation public.leave_allocations%ROWTYPE;
  total_used_days INTEGER;
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
        -- Calculate total used days from all approved leave requests
        SELECT COALESCE(SUM(duration), 0) INTO total_used_days
        FROM public.leave_requests
        WHERE 
          employee_id = NEW.employee_id AND
          type = NEW.type AND
          status = 'Approved' AND
          id <> NEW.id; -- Exclude the current request
        
        -- Add the current request duration
        total_used_days := total_used_days + NEW.duration;
        
        -- Update allocation with the total used days
        UPDATE public.leave_allocations 
        SET 
          used_days = total_used_days,
          remaining_days = allocation_days - total_used_days
        WHERE id = current_allocation.id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
