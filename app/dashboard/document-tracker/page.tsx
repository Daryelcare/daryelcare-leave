import type { Metadata } from "next"
<<<<<<< HEAD
import { Suspense } from "react"
=======
>>>>>>> origin/claude/tender-gates-d8wf98
import { DocumentTrackerTable } from "@/components/document-tracker-table"

export const metadata: Metadata = {
  title: "Documents",
  description: "Track employee right-to-work, passport and visa expiry",
}

export default function DocumentTrackerPage() {
<<<<<<< HEAD
  // Filters are read from the address, which needs a Suspense boundary
  return (
    <Suspense>
      <DocumentTrackerTable />
    </Suspense>
  )
=======
  return <DocumentTrackerTable />
>>>>>>> origin/claude/tender-gates-d8wf98
}
