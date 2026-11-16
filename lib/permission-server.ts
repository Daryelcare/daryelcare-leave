// Server side of permissions: reads the organisation's manager settings and
// saves changes. Server only.

import { supabase } from "./db"
import { isMissingSchema } from "./column-probe"
import { cleanOverrides, managerDefaults, type PermissionOverrides, type PermissionSet } from "./permissions"

const KEY = "manager_permissions"
let cache: { value: PermissionOverrides; at: number; stored: boolean } | null = null

/** What admins have changed from the built-in defaults, and whether it can be stored yet */
export async function loadOrgPermissions(): Promise<{ saved: PermissionOverrides; stored: boolean }> {
  if (cache && Date.now() - cache.at < 15_000) return { saved: cache.value, stored: cache.stored }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from("app_settings").select("value").eq("key", KEY).maybeSingle()
  if (error) {
    if (!isMissingSchema(error)) console.error("Couldn't read permission settings:", error)
    cache = { value: {}, at: Date.now(), stored: false }
    return { saved: {}, stored: false }
  }
  const saved = cleanOverrides(data?.value)
  cache = { value: saved, at: Date.now(), stored: true }
  return { saved, stored: true }
}

export async function orgManagerPermissions(): Promise<PermissionSet> {
  return managerDefaults((await loadOrgPermissions()).saved)
}

export async function saveOrgPermissions(saved: PermissionOverrides, by: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("app_settings")
    .upsert({ key: KEY, value: cleanOverrides(saved), updated_at: new Date().toISOString(), updated_by: by })
  if (error) throw error
  cache = null
}

export const forgetPermissionCache = () => {
  cache = null
}
