// What branch managers may do. Admins can always do everything; for branch
// managers each action below can be allowed or denied by an admin:
//
// - organisation-wide, for every branch manager (Settings → Permissions)
// - per person, overriding that (Settings → Users & access → Permissions)
//
// Everything is still limited to the manager's own branches. Shared by the
// server (which enforces it) and the screens (which hide what's denied).

export type PermissionKey =
  | "employees_edit"
  | "employees_delete"
  | "employees_import"
  | "leave_edit"
  | "leave_approve"
  | "leave_delete"
  | "documents_view"
  | "documents_edit"
  | "documents_delete"
  | "documents_import"
  | "export"
  | "reports"

export type PermissionGroup = "Employees" | "Leave" | "Documents" | "Reports & exports"

export const PERMISSIONS: {
  key: PermissionKey
  group: PermissionGroup
  label: string
  description: string
  /** What branch managers get before an admin changes anything (today's behaviour) */
  default: boolean
  /** Only meaningful when this one is allowed too */
  needs?: PermissionKey
}[] = [
  { key: "employees_edit", group: "Employees", label: "Add and edit employees", description: "Add people, change their details, mark them as left or move them between their branches.", default: true },
  { key: "employees_delete", group: "Employees", label: "Delete employees", description: "Remove employee records for good.", default: true },
  { key: "employees_import", group: "Employees", label: "Import employees", description: "Add or update people from a spreadsheet.", default: true },
  { key: "leave_edit", group: "Leave", label: "Add and edit leave", description: "Record leave and change existing entries.", default: true },
  { key: "leave_approve", group: "Leave", label: "Approve and reject leave", description: "Decide on pending requests.", default: true },
  { key: "leave_delete", group: "Leave", label: "Delete leave", description: "Remove leave entries (gives the days back).", default: true },
  { key: "documents_view", group: "Documents", label: "See documents", description: "The Documents page: right to work, passports, visas.", default: true },
  { key: "documents_edit", group: "Documents", label: "Add and edit documents", description: "Record documents, change dates, set how right to work is held.", default: true, needs: "documents_view" },
  { key: "documents_delete", group: "Documents", label: "Delete document records", description: "Remove a person's documents record.", default: true, needs: "documents_view" },
  { key: "documents_import", group: "Documents", label: "Import documents", description: "Add or update documents from a spreadsheet.", default: true, needs: "documents_view" },
  { key: "export", group: "Reports & exports", label: "Export lists", description: "Download employee, leave and document lists as CSV or Excel.", default: true },
  { key: "reports", group: "Reports & exports", label: "Reports page", description: "Leave totals by branch, month and type, and the Bradford Factor.", default: false },
]

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key)
export const isPermissionKey = (k: unknown): k is PermissionKey => PERMISSION_KEYS.includes(k as PermissionKey)

/** Allowed (true) / denied (false) for each permission */
export type PermissionSet = Record<PermissionKey, boolean>
/** Per-person overrides: only the keys that differ from the organisation's setting */
export type PermissionOverrides = Partial<Record<PermissionKey, boolean>>

export const BUILT_IN_DEFAULTS: PermissionSet = Object.fromEntries(
  PERMISSIONS.map((p) => [p.key, p.default]),
) as PermissionSet

export const ALL_ALLOWED: PermissionSet = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true])) as PermissionSet

/** Keeps only known keys with true/false values */
export function cleanOverrides(value: unknown): PermissionOverrides {
  const out: PermissionOverrides = {}
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isPermissionKey(k) && typeof v === "boolean") out[k] = v
    }
  }
  return out
}

/** The organisation's manager settings: built-in defaults with any saved changes on top */
export function managerDefaults(saved: unknown): PermissionSet {
  return { ...BUILT_IN_DEFAULTS, ...cleanOverrides(saved) }
}

/**
 * What one person may do: everything for admins; for branch managers the
 * organisation's settings with their own overrides on top. A permission that
 * needs another (e.g. editing documents needs seeing them) is off when that
 * one is off.
 */
export function effectivePermissions(
  role: string,
  orgSaved: unknown,
  personal: unknown,
): PermissionSet {
  if (role === "admin") return { ...ALL_ALLOWED }
  const set = { ...managerDefaults(orgSaved), ...cleanOverrides(personal) }
  for (const p of PERMISSIONS) if (p.needs && !set[p.needs]) set[p.key] = false
  return set
}

/** The plain-words refusal shown when an action is denied */
export function deniedMessage(key: PermissionKey) {
  const p = PERMISSIONS.find((x) => x.key === key)
  return `An administrator has turned off "${p?.label ?? key}" for your account.`
}
