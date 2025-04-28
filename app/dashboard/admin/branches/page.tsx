"use client"

import { BranchManagementTable } from "@/components/branch-management-table"

export default function BranchesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Branch Management</h1>
        <p className="text-muted-foreground">Add, edit, and manage company branches</p>
      </div>
      <BranchManagementTable />
    </div>
  )
}
