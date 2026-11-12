"use client"

import { BranchManagementTable } from "@/components/branch-management-table"
import { PageHeader } from "@/components/page-kit"

export default function BranchesPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader title="Branches" description="Add, rename and remove the branches your staff work in." />
      <div className="max-w-3xl">
        <BranchManagementTable />
      </div>
    </div>
  )
}
