-- Update documents table to use separate fields for each document type
ALTER TABLE public.documents 
DROP COLUMN IF EXISTS expiry_date,
DROP COLUMN IF EXISTS days_left,
ADD COLUMN IF NOT EXISTS passport_expiry TEXT,
ADD COLUMN IF NOT EXISTS passport_days_left INTEGER,
ADD COLUMN IF NOT EXISTS right_to_work_expiry TEXT,
ADD COLUMN IF NOT EXISTS right_to_work_days_left INTEGER,
ADD COLUMN IF NOT EXISTS brp_expiry TEXT,
ADD COLUMN IF NOT EXISTS brp_days_left INTEGER,
ADD COLUMN IF NOT EXISTS other_document_type TEXT,
ADD COLUMN IF NOT EXISTS other_document_expiry TEXT,
ADD COLUMN IF NOT EXISTS other_document_days_left INTEGER;
