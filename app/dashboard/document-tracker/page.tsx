import type { Metadata } from "next"
import { Suspense } from "react"
import { DocumentTrackerTable } from "@/components/document-tracker-table"
import { PermissionGate } from "@/components/permission-gate"

export const metadata: Metadata = {
  title: "Documents",
  description: "Track employee right-to-work, passport and visa expiry",
}

export default function DocumentTrackerPage() {
  // Filters are read from the address, which needs a Suspense boundary
  return (
    <PermissionGate permission="documents_view" title="Documents">
      <Suspense>
        <DocumentTrackerTable />
      </Suspense>
    </PermissionGate>
  )
}
