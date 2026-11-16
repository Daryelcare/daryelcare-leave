// Whether optional columns added by a migration exist yet, so features can
// switch on by themselves once the SQL has been run. A "yes" is remembered;
// a "no" is checked again after a minute. Server only.

import { supabase } from "./db"

const known = new Map<string, { ok: boolean; at: number }>()

/** True when the error is "that column/table doesn't exist" */
export const isMissingSchema = (error: unknown) => {
  const e = error as { code?: string; message?: string } | null
  return !!e && ["42703", "42P01", "PGRST204", "PGRST205"].includes(e.code || "")
}

export async function columnsExist(table: string, columns: string[]): Promise<boolean> {
  const key = `${table}:${columns.join(",")}`
  const seen = known.get(key)
  if (seen && (seen.ok || Date.now() - seen.at < 60_000)) return seen.ok
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from(table).select(columns.join(", ")).limit(1)
  const ok = !error
  if (error && !isMissingSchema(error)) console.error(`Couldn't check for ${key}:`, error)
  known.set(key, { ok, at: Date.now() })
  return ok
}

/** Forget what's known (tests) */
export const forgetColumnProbes = () => known.clear()

export const allowanceColumnExists = () => columnsExist("employees", ["annual_allowance"])
