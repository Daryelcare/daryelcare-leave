-- One-time password change for everyone, and a first-sign-in password change
-- for accounts an admin creates or resets.
--
-- Run once in the Supabase SQL editor. Adds one column and switches it on
-- for every existing account: the next time each person opens the app they
-- choose a new password (at least 6 characters, not their current one), and
-- the flag clears itself. Nothing else changes.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- The one-time change: everyone who has an account today
UPDATE public.users SET must_change_password = true;
