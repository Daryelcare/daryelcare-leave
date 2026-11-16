-- When each person last opened the app (every visit, not only password sign-ins)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
