-- Add sponsored fields to documents table
ALTER TABLE public.documents 
ADD COLUMN is_sponsored BOOLEAN DEFAULT false,
ADD COLUMN sponsorship_expiry TEXT,
ADD COLUMN sponsorship_days_left INTEGER;
