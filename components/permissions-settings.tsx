"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Info, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { PERMISSIONS, type PermissionGroup, type PermissionKey, type PermissionSet } from "@/lib/permissions"
import { ErrorState, ListSkeleton, SectionHeader } from "./page-kit"

type Status = { stored: boolean; perPerson: boolean; settings: PermissionSet; defaults: PermissionSet }

export const PERMISSION_GROUPS = [...new Set(PERMISSIONS.map((p) => p.group))] as PermissionGroup[]

/**
 * Settings → Permissions: what every branch manager may do. Admins can always
 * do everything. Per-person exceptions live in Users & access.
 */
export function PermissionsSettings({ title, description }: { title: string; description: string }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error, refetch } = useQuery<Status>({
    queryKey: ["permissions"],
    queryFn: () => fetchWithAuth("/api/permissions"),
  })
  const [draft, setDraft] = useState<PermissionSet | null>(null)
  useEffect(() => {
    if (data) setDraft(data.settings)
  }, [data])

  const changed = useMemo(
    () => !!data && !!draft && PERMISSIONS.some((p) => draft[p.key] !== data.settings[p.key]),
    [data, draft],
  )

  const save = useMutation<{ settings: PermissionSet }, Error, PermissionSet>({
    mutationFn: (settings) => fetchWithAuth("/api/permissions", { method: "PUT", body: JSON.stringify({ settings }) }),
    onSuccess: () => {
      toast({ title: "Permissions saved", description: "Branch managers get the change straight away." })
      queryClient.invalidateQueries({ queryKey: ["permissions"] })
    },
    onError: (e) => {
      console.error("Couldn't save permissions:", e)
      toast({ title: "Couldn't save", description: handleApiError(e), variant: "destructive" })
    },
  })

  const toggle = (key: PermissionKey, on: boolean) => setDraft((d) => (d ? { ...d, [key]: on } : d))

  return (
    <div className="space-y-4">
      <SectionHeader
        title={title}
        description={description}
        actions={
          <Button onClick={() => draft && save.mutate(draft)} disabled={!changed || save.isPending || !data?.stored}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        }
      />

      {isError ? (
        <ErrorState title="Couldn't load permissions" message={handleApiError(error)} onRetry={() => refetch()} />
      ) : isLoading || !draft || !data ? (
        <div className="surface p-3">
          <ListSkeleton rows={6} />
        </div>
      ) : (
        <>
          {!data.stored && (
            <p className="flex gap-2.5 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              These switches need a one-off database update before they can be changed. Until then branch managers
              have the settings shown.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            These apply to every branch manager, and only ever within their own branches. Administrators can always do
            everything. To make an exception for one person, use <strong>Users &amp; access → Permissions</strong>.
          </p>
          {PERMISSION_GROUPS.map((group) => (
            <section key={group} className="surface p-2 sm:p-3" aria-label={group}>
              <h3 className="px-3 pb-2 pt-2 text-[15px] font-bold">{group}</h3>
              <ul className="flex flex-col gap-1.5">
                {PERMISSIONS.filter((p) => p.group === group).map((p) => {
                  const blockedBy = p.needs && !draft[p.needs] ? PERMISSIONS.find((x) => x.key === p.needs) : null
                  return (
                    <li key={p.key} className="flex items-center gap-4 rounded-2xl bg-background px-4 py-3">
                      <label htmlFor={`perm-${p.key}`} className="min-w-0 flex-1 cursor-pointer">
                        <span className="block text-sm font-semibold">{p.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {blockedBy ? `Off while "${blockedBy.label}" is off. ` : ""}
                          {p.description}
                        </span>
                      </label>
                      <span className="w-14 text-right text-xs font-semibold text-muted-foreground">
                        {draft[p.key] && !blockedBy ? "Allowed" : "Off"}
                      </span>
                      <Switch
                        id={`perm-${p.key}`}
                        checked={draft[p.key]}
                        onCheckedChange={(on) => toggle(p.key, on)}
                        disabled={!data.stored || save.isPending}
                        aria-label={p.label}
                      />
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
