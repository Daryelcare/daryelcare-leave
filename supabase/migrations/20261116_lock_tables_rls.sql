-- Lock every table so only the server can read or write it.
--
-- Before this, the public (anon) key that ships to every browser could read
-- (and likely change) employees, users, documents and leave directly, by
-- calling the database's REST API without going through the app.
--
-- ORDER MATTERS: run this only AFTER the version of the app that uses the
-- server's service-role key (lib/db.ts) is live in production. Otherwise the
-- app itself loses access. To undo in an emergency, see the end of this file.
--
-- What it does (nothing is deleted from your data):
-- 1. Turns on row-level security for every table in the public schema. With
--    no policies, the public and signed-in browser roles see nothing; the
--    server's service-role key is not affected.
-- 2. Removes any existing policies that opened tables up (the app no longer
--    reads tables from the browser, so none are needed).
-- 3. Takes table, sequence and function rights away from the browser roles
--    (anon, authenticated), including for tables created later.

-- 1. Row-level security on every table
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- 2. Remove policies that let the browser in
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- 3. Browser roles get no direct rights; the server keeps them
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, PUBLIC;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role, supabase_auth_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, PUBLIC;

-- Check (read-only): every table should show rls_on = true, anon_can_read =
-- false and policies = 0.
--
-- SELECT c.relname AS table_name,
--        c.relrowsecurity AS rls_on,
--        has_table_privilege('anon', c.oid, 'SELECT') AS anon_can_read,
--        (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
-- FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relkind = 'r'
-- ORDER BY 1;
--
-- Emergency undo (only if the app stops loading data and you need it back
-- while the cause is fixed; this reopens the tables to the public key):
--
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
-- DO $$ DECLARE t record; BEGIN
--   FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
--     EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t.tablename);
--   END LOOP; END $$;
