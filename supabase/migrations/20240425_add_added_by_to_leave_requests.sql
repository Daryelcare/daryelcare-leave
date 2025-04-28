-- Add added_by column to leave_requests table
ALTER TABLE public.leave_requests 
ADD COLUMN added_by VARCHAR(255);
