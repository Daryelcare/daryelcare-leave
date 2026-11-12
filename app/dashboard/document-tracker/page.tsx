import type { Metadata } from "next"
import { Suspense } from "react"
import { DocumentTrackerTable } from "@/components/document-tracker-table"

export const metadata: Metadata = {
  title: "Documents",
  description: "Track employee right-to-work, passport and visa expiry",
}

export default function DocumentTrackerPage() {
  // Filters are read from the address, which needs a Suspense boundary
  return (
    <Suspense>
      <DocumentTrackerTable />
    </Suspense>
  )
}
