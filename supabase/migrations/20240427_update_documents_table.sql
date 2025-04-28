-- Update documents table to use a single expiry date field
ALTER TABLE public.documents 
DROP COLUMN IF EXISTS passport_expiry,
DROP COLUMN IF EXISTS passport_days_left,
DROP COLUMN IF EXISTS right_to_work_expiry,
DROP COLUMN IF EXISTS right_to_work_days_left,
DROP COLUMN IF EXISTS sponsorship_expiry,
DROP COLUMN IF EXISTS sponsorship_days_left,
ADD COLUMN IF NOT EXISTS expiry_date TEXT,
ADD COLUMN IF NOT EXISTS days_left INTEGER;
