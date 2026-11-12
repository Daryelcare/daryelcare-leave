import type { Metadata } from "next"
import { DocumentTrackerTable } from "@/components/document-tracker-table"

export const metadata: Metadata = {
  title: "Documents",
  description: "Track employee right-to-work, passport and visa expiry",
}

export default function DocumentTrackerPage() {
  return <DocumentTrackerTable />
}
