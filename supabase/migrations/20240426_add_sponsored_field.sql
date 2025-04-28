-- Add sponsored field to documents table
ALTER TABLE public.documents 
ADD COLUMN is_sponsored BOOLEAN DEFAULT false;
