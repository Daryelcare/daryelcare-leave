-- Automatic leave year (like CarerHR): a nightly job starts the next leave
-- year when the current one ends and keeps every balance in line with the
-- leave on record. See app/api/cron/leave-year/route.ts.
--
-- Additive only. Run once in the Supabase SQL editor.
--
-- 1. Each person's yearly allowance in whole days. Empty means the standard
--    28. Nothing existing changes: everyone starts on 28 until an admin sets
--    a different allowance (e.g. for part-time staff).
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS annual_allowance INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_annual_allowance_range') THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_annual_allowance_range
      CHECK (annual_allowance IS NULL OR (annual_allowance >= 0 AND annual_allowance <= 366));
  END IF;
END $$;

-- 2. A record of each run, shown in Settings ("Last automatic check").
--    Locked down: row-level security on and no policies, so only the server
--    (service role key) can read or write it.
CREATE TABLE IF NOT EXISTS public.leave_job_runs (
  id BIGSERIAL PRIMARY KEY,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trigger TEXT NOT NULL CHECK (trigger IN ('nightly', 'manual')),
  leave_year TEXT,
  new_year_started BOOLEAN NOT NULL DEFAULT false,
  balances_changed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  ok BOOLEAN NOT NULL DEFAULT true,
  message TEXT
);
ALTER TABLE public.leave_job_runs ENABLE ROW LEVEL SECURITY;
