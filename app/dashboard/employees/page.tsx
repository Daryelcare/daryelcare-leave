import type { Metadata } from "next"
import { EmployeeTable } from "@/components/employee-table"

export const metadata: Metadata = {
  title: "Employees",
  description: "View and manage employees across your branches",
}

export default function EmployeesPage() {
  return <EmployeeTable />
}
