// When each person last opened the app, for "Last visit" on Users & access.
// Switches itself on once the SQL has been run. Server only.

import { supabase } from "./db"
import { columnsExist } from "./column-probe"

export const lastSeenColumnExists = () => columnsExist("users", ["last_seen_at"])

/** Records a visit now. Never throws: a visit must not stop anyone using the app. */
export async function recordVisit(email: string): Promise<void> {
  try {
    if (!(await lastSeenColumnExists())) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("users") as any)
      .update({ last_seen_at: new Date().toISOString() })
      .eq("email", email)
    if (error) console.error("Couldn't record a visit:", error)
  } catch (e) {
    console.error("Couldn't record a visit:", e)
  }
}
