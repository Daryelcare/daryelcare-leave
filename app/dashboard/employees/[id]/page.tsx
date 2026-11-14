import { redirect } from "next/navigation"

// Profiles open in a panel on the Employees page; old profile links land there
export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/dashboard/employees?person=${encodeURIComponent(id)}`)
}
