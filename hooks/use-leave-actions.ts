"use client"

// Approve / reject / reset to pending / delete for one or many leave entries,
// with one summary toast. Shared by the row menus, the bulk bar and the
// request panel on the Leave page.

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"

export type Decision = "Approved" | "Rejected" | "Pending"
type Target = { id: string; employee: string }

const DONE: Record<Decision, string> = { Approved: "approved", Rejected: "rejected", Pending: "reset to pending" }

export function useLeaveActions() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())

  const refresh = () => {
    for (const key of [
      "leaveRequests",
      "leaveRequestsAll",
      "employees",
      "employee",
      "dashboard",
      "leave-calendar",
      "whos-on-leave",
    ]) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }

  const run = async (targets: Target[], call: (t: Target) => Promise<{ noteSaved?: boolean } | void>) => {
    setBusyIds((prev) => new Set([...prev, ...targets.map((t) => t.id)]))
    const results = await Promise.allSettled(targets.map(call))
    setBusyIds((prev) => {
      const next = new Set(prev)
      targets.forEach((t) => next.delete(t.id))
      return next
    })
    refresh()
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[]
    const noteLost = results.some((r) => r.status === "fulfilled" && r.value && r.value.noteSaved === false)
    return { ok: targets.length - failed.length, failed, noteLost }
  }

  /** Approve, reject (note required) or reset to pending */
  const decide = async (targets: Target[], status: Decision, note?: string) => {
    if (!targets.length) return false
    const { ok, failed, noteLost } = await run(targets, (t) =>
      fetchWithAuth(`/api/leave-requests/${t.id}`, {
        method: "PUT",
        body: JSON.stringify({ status, note: note?.trim() || undefined }),
      }),
    )
    const who = targets.length === 1 ? `${targets[0].employee}'s leave` : `${ok} ${ok === 1 ? "entry" : "entries"}`
    if (ok > 0) {
      toast({
        title:
          targets.length === 1 ? `Leave ${DONE[status]}` : `${ok} ${ok === 1 ? "entry" : "entries"} ${DONE[status]}`,
        description: noteLost
          ? "The note couldn't be saved yet: the database needs the update in supabase/migrations/20261113_add_leave_decision_fields.sql."
          : targets.length === 1
            ? `${who} is now ${status === "Pending" ? "pending" : status.toLowerCase()}.`
            : undefined,
      })
    }
    if (failed.length) {
      toast({
        title: failed.length === targets.length ? "Couldn't update the leave" : `${failed.length} couldn't be updated`,
        description: handleApiError(failed[0].reason),
        variant: "destructive",
      })
    }
    return failed.length === 0
  }

  /** Delete entries; approved leave gives its days back */
  const remove = async (targets: Target[]) => {
    if (!targets.length) return false
    const { ok, failed } = await run(targets, (t) => fetchWithAuth(`/api/leave-requests/${t.id}`, { method: "DELETE" }))
    if (ok > 0) {
      toast({
        title: ok === 1 ? "Leave deleted" : `${ok} entries deleted`,
        description: "Any days they used went back to the balance.",
      })
    }
    if (failed.length) {
      toast({
        title: failed.length === targets.length ? "Couldn't delete the leave" : `${failed.length} couldn't be deleted`,
        description: handleApiError(failed[0].reason),
        variant: "destructive",
      })
    }
    return failed.length === 0
  }

  return { decide, remove, busyIds }
}
