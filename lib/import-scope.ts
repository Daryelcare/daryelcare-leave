// Branch rules for imports, so branch managers can import too but only into
// their own branches. Admins keep the old behaviour.

import { allowedBranches, type RequestUser } from "./server-auth"

/**
 * The branch a new or updated employee row goes into, or a plain-words error.
 * - Admins: the row's branch, or "Unassigned" when blank (as before).
 * - Managers: the row's branch must be one of theirs; a blank branch uses
 *   their branch when they manage exactly one.
 */
export function importBranch(user: RequestUser, rowBranch: unknown): { branch: string } | { error: string } {
  const given = typeof rowBranch === "string" ? rowBranch.trim() : rowBranch ? String(rowBranch).trim() : ""
  const allowed = allowedBranches(user)
  if (allowed === null) return { branch: given || "Unassigned" }
  if (!given) {
    if (allowed.length === 1) return { branch: allowed[0] }
    return { error: `Add a Branch (one of yours: ${allowed.join(", ") || "none assigned"})` }
  }
  if (!allowed.includes(given)) {
    return { error: `${given} isn't one of your branches (${allowed.join(", ") || "none assigned"})` }
  }
  return { branch: given }
}
