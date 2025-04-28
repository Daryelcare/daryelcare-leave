import { DocumentTrackerTable } from "@/components/document-tracker-table"

export default function DocumentTrackerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Document Tracker</h1>
        <p className="text-muted-foreground">Manage employee documents and track expiry dates</p>
      </div>
      <DocumentTrackerTable />
    </div>
  )
}
