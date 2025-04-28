-- Create a function to reset all leave balances
CREATE OR REPLACE FUNCTION reset_all_leave_balances(new_days_remaining INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update all active leave allocations
  UPDATE leave_allocations
  SET 
    days_remaining = new_days_remaining,
    days_taken = 0,
    updated_at = NOW()
  WHERE is_active = true;
END;
$$;
