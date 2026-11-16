-- Admin-controlled permissions for branch managers (Settings → Permissions,
-- and per person in Settings → Users & access). See lib/permissions.ts.
--
-- Additive only. Run once in the Supabase SQL editor. Until it's run, branch
-- managers keep today's permissions and the switches say the update is needed.

-- Organisation-wide settings, as key → JSON. Locked to the server.
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;

-- Per-person exceptions: only the switches that differ from the organisation's
-- setting, e.g. {"employees_import": false}. Empty means "same as everyone".
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS permission_overrides JSONB;
