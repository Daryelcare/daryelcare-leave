-- Right to work: how it's held, and when it was last checked. This decides
-- when the next check is due (see lib/rtw.ts):
--   british_irish        British or Irish citizen: one check is enough
--   indefinite           Indefinite leave to remain / EU settled status: one check is enough
--   time_limited         Visa, pre-settled status, eVisa with an end date: check again by that date
--   pending_application  Employer Checking Service result: check again 6 months after the check
--
-- Additive only: two new empty columns on documents. Nothing existing is
-- changed or deleted; right_to_work_expiry keeps its dates. Run once in the
-- Supabase SQL editor. Until it is run the app works as before, and the
-- "How it's held" choice says this needs setting up.

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS rtw_basis TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS rtw_checked_on TEXT; -- DD/MM/YYYY, like the other dates

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_rtw_basis_check') THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_rtw_basis_check
      CHECK (rtw_basis IS NULL OR rtw_basis IN ('british_irish', 'indefinite', 'time_limited', 'pending_application'));
  END IF;
END $$;
