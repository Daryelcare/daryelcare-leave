import { UserManagementTable } from "@/components/user-management-table"

export default function UserManagementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">Manage user roles and branch assignments</p>
      </div>
      <UserManagementTable />
    </div>
  )
}
