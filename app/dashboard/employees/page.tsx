import type { Metadata } from "next"
import { Suspense } from "react"
import { EmployeeDirectory } from "@/components/employee-directory"

export const metadata: Metadata = {
  title: "Employees",
  description: "Everyone in your branches: leave, right to work and details",
}

export default function EmployeesPage() {
  // Filters are read from the address, which needs a Suspense boundary
  return (
    <Suspense>
      <EmployeeDirectory />
    </Suspense>
  )
}
