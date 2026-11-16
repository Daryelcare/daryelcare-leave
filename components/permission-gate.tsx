"use client"

import type { ReactNode } from "react"
import { Lock } from "lucide-react"
import { useApp, canDo } from "./app-provider"
import { EmptyState, PageHeader } from "./page-kit"
import type { PermissionKey } from "@/lib/permissions"

/**
 * Shows the page only when the signed-in person may use it. Opening a page an
 * admin has turned off (e.g. from an old link) explains why instead of failing.
 */
export function PermissionGate({ permission, title, children }: { permission: PermissionKey; title: string; children: ReactNode }) {
  const { user } = useApp()
  if (!user || canDo(user, permission)) return <>{children}</>
  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader title={title} />
      <div className="surface">
        <EmptyState
          icon={Lock}
          title="Not available for your account"
          description="An administrator has turned this off. Ask them if you need it."
        />
      </div>
    </div>
  )
}
