import type { Metadata } from "next"
import { EmployeeTable } from "@/components/employee-table"

export const metadata: Metadata = {
  title: "Employees - Annual Leave Management System",
  description: "View and manage employees in your organization",
}

export default function EmployeesPage() {
  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
        <p className="text-muted-foreground">A list of all employees in your organization.</p>
      </div>
      <div className="w-full">
        <EmployeeTable />
      </div>
    </div>
  )
}
