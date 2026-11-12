import type { Metadata } from "next"
import { UserManagementTable } from "@/components/user-management-table"

export const metadata: Metadata = {
  title: "Users & Access",
  description: "Manage who can sign in, their roles and branches",
}

export default function UserManagementPage() {
  return <UserManagementTable />
}
