"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { PERMISSIONS, type PermissionKey, type PermissionOverrides, type PermissionSet } from "@/lib/permissions"
import type { User } from "@/lib/types"
import { cn } from "@/lib/utils"
import { PERMISSION_GROUPS } from "./permissions-settings"

type Choice = "default" | "allow" | "deny"

/**
 * One branch manager's exceptions to the organisation's permissions. Each
 * switch is "Same as everyone" (the setting in Settings → Permissions),
 * "Allow" or "Deny".
 */
export function UserPermissionsDialog({
  user,
  open,
  onOpenChange,
}: {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: org } = useQuery<{ stored: boolean; perPerson: boolean; settings: PermissionSet }>({
    queryKey: ["permissions"],
    queryFn: () => fetchWithAuth("/api/permissions"),
    enabled: open,
  })
  const [choices, setChoices] = useState<Partial<Record<PermissionKey, Choice>>>({})
  useEffect(() => {
    if (!open || !user) return
    const next: Partial<Record<PermissionKey, Choice>> = {}
    for (const [k, v] of Object.entries(user.permissionOverrides ?? {})) next[k as PermissionKey] = v ? "allow" : "deny"
    setChoices(next)
  }, [open, user])

  const save = useMutation({
    mutationFn: (overrides: PermissionOverrides) =>
      fetchWithAuth(`/api/users/${user?.id}/permissions`, { method: "PUT", body: JSON.stringify({ overrides }) }),
    onSuccess: () => {
      toast({ title: "Permissions saved", description: `${user?.name || user?.email} gets the change straight away.` })
      queryClient.invalidateQueries({ queryKey: ["users"] })
      onOpenChange(false)
    },
    onError: (e) => {
      console.error("Couldn't save a user's permissions:", e)
      toast({ title: "Couldn't save", description: handleApiError(e), variant: "destructive" })
    },
  })

  const submit = () => {
    const overrides: PermissionOverrides = {}
    for (const [k, c] of Object.entries(choices)) {
      if (c === "allow") overrides[k as PermissionKey] = true
      if (c === "deny") overrides[k as PermissionKey] = false
    }
    save.mutate(overrides)
  }

  const exceptions = Object.values(choices).filter((c) => c && c !== "default").length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Permissions for {user?.name || user?.email}</DialogTitle>
          <DialogDescription>
            Exceptions to what every branch manager may do (Settings → Permissions). Always limited to their own
            branches.
          </DialogDescription>
        </DialogHeader>

        {org && !org.perPerson ? (
          <p className="rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">
            Per-person permissions need a one-off database update first.
          </p>
        ) : (
          <div className="max-h-[60dvh] space-y-4 overflow-y-auto pr-1">
            {PERMISSION_GROUPS.map((group) => (
              <section key={group} aria-label={group} className="space-y-1.5">
                <h3 className="text-[13px] font-bold text-secondary-foreground">{group}</h3>
                {PERMISSIONS.filter((p) => p.group === group).map((p) => {
                  const choice = choices[p.key] ?? "default"
                  const everyone = org?.settings[p.key]
                  return (
                    <div
                      key={p.key}
                      className="flex flex-col gap-2 rounded-2xl bg-background px-3.5 py-2.5 sm:flex-row sm:items-center"
                    >
                      <span className="min-w-0 flex-1 text-sm font-semibold">{p.label}</span>
                      <div
                        role="radiogroup"
                        aria-label={p.label}
                        className="inline-flex shrink-0 gap-[3px] rounded-full bg-card p-1 shadow-soft"
                      >
                        {(
                          [
                            ["default", `Same as everyone${everyone === undefined ? "" : everyone ? " (on)" : " (off)"}`],
                            ["allow", "Allow"],
                            ["deny", "Deny"],
                          ] as const
                        ).map(([value, label]) => {
                          const active = choice === value
                          return (
                            <button
                              key={value}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => setChoices((c) => ({ ...c, [p.key]: value }))}
                              className={cn(
                                "h-8 rounded-full px-3 text-xs font-bold transition-colors",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                                active
                                  ? value === "deny"
                                    ? "bg-destructive text-destructive-foreground"
                                    : "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </section>
            ))}
          </div>
        )}

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {exceptions ? `${exceptions} exception${exceptions === 1 ? "" : "s"}` : "No exceptions: same as everyone"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={save.isPending || (!!org && !org.perPerson)}>
              {save.isPending && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
