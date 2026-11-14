import type { Metadata } from "next"
import { Suspense } from "react"
import { EmployeeProfile } from "@/components/employee-profile"

export const metadata: Metadata = {
  title: "Employee",
  description: "One employee: details, leave and documents",
}

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense>
      <EmployeeProfile id={id} />
    </Suspense>
  )
}
