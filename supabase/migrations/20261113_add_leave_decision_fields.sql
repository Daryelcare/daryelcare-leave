-- Approve / reject / reset from the Leave page: keep the admin's note and who
-- made the last decision, and when. Additive only: existing rows are untouched
-- (the new columns start empty). Run once in the Supabase SQL editor.
--
-- Until this is run the app still approves, rejects and resets leave; it just
-- can't save the note, and says so.

ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS decided_by TEXT;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
