"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, AlertCircle, MoreHorizontal } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { useApp } from "./app-provider"
import { AddUserModal } from "./add-user-modal"
import { EditBranchesModal } from "./edit-branches-modal"
import { ResetPasswordModal } from "./reset-password-modal"
import type { User } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ColumnDef } from "@tanstack/react-table"

export function UserManagementTable() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user: currentUser } = useApp()

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditBranchesModalOpen, setIsEditBranchesModalOpen] = useState(false)
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [showFallbackOption, setShowFallbackOption] = useState(false)

  // Fetch users data
  const {
    data: users = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      return fetchWithAuth("/api/users")
    },
  })

  // Delete user function
  const deleteUser = async (id: string, useFallback = false) => {
    // Prevent deleting the current user
    if (currentUser && id === currentUser.id) {
      toast({
        title: "Error",
        description: "You cannot delete your own account",
        variant: "destructive",
      })
      return
    }

    try {
      setDeleteError(null)
      const endpoint = useFallback ? `/api/users/${id}/fallback-delete` : `/api/users/${id}`

      const response = await fetchWithAuth(endpoint, {
        method: "DELETE",
      })

      if (response.error) {
        throw new Error(response.error)
      }

      toast({
        title: "Success",
        description: useFallback
          ? "User deleted from database only. Auth record may still exist."
          : "User deleted successfully",
      })

      // Refresh the users list
      queryClient.invalidateQueries({ queryKey: ["users"] })
      setShowFallbackOption(false)
    } catch (error) {
      const errorMessage = handleApiError(error)
      setDeleteError(errorMessage)
      setShowFallbackOption(true)

      toast({
        title: "Error",
        description: `Failed to delete user: ${errorMessage}`,
        variant: "destructive",
      })
    }
  }

  // Handle edit branches
  const handleEditBranches = (user: User) => {
    setSelectedUser(user)
    setIsEditBranchesModalOpen(true)
  }

  // Handle reset password
  const handleResetPassword = (user: User) => {
    setSelectedUser(user)
    setIsResetPasswordModalOpen(true)
  }

  // Handle delete user
  const handleDeleteUser = (user: User) => {
    setSelectedUser(user)
    setIsDeleteDialogOpen(true)
  }

  // Confirm delete user
  const confirmDeleteUser = () => {
    if (selectedUser) {
      deleteUser(selectedUser.id)
      // Don't close the dialog yet - we'll close it on success
    }
  }

  // Use fallback delete
  const useFallbackDelete = () => {
    if (selectedUser) {
      deleteUser(selectedUser.id, true)
      setIsDeleteDialogOpen(false)
      setSelectedUser(null)
    }
  }

  const handleRoleChange = async (user: User, newRole: "admin" | "normal") => {
    try {
      // If changing to normal user, they need branch assignments
      const branches = newRole === "normal" ? [] : ["All branches"]

      await fetchWithAuth(`/api/users/${user.id}/update-role`, {
        method: "PUT",
        body: JSON.stringify({ role: newRole, branches }),
      })

      toast({
        title: "Success",
        description: `User role updated to ${newRole}`,
      })

      queryClient.invalidateQueries({ queryKey: ["users"] })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to update user role: ${handleApiError(error)}`,
        variant: "destructive",
      })
    }
  }

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant={row.original.role === "admin" ? "default" : "outline"}>{row.original.role}</Badge>
      ),
    },
    {
      accessorKey: "branches",
      header: "Branches",
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          {row.original.branches && row.original.branches.length > 0 ? (
            row.original.branches.map((branch, index) => (
              <span key={index} className="text-sm">
                {branch}
              </span>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">No branches assigned</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created At",
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const user = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleEditBranches(user)}>Edit Branches</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleResetPassword(user)}>Reset Password</DropdownMenuItem>
              <DropdownMenuSeparator />
              {user.role === "admin" ? (
                <DropdownMenuItem
                  onClick={() => handleRoleChange(user, "normal")}
                  disabled={user.id === currentUser?.id}
                >
                  Change to Normal User
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => handleRoleChange(user, "admin")}
                  disabled={user.id === currentUser?.id}
                >
                  Change to Admin
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => handleDeleteUser(user)}
                disabled={user.id === currentUser?.id}
              >
                Delete User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  if (isError) {
    return (
      <div className="rounded-md bg-destructive/15 p-4 text-destructive">
        <p>Error loading users: {handleApiError(error)}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">User List</h2>
        <Button
          className="gap-2 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
          onClick={() => setIsAddModalOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Branches</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 2 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-6 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-32" />
                  </TableCell>
                </TableRow>
              ))
            ) : users.length > 0 ? (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>{user.name || "N/A"}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "outline"}>{user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {user.branches && user.branches.length > 0 ? (
                        user.branches.map((branch, index) => (
                          <span key={index} className="text-sm">
                            {branch}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No branches assigned</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{user.createdAt}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      {user.role === "normal" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="justify-start"
                          onClick={() => handleEditBranches(user)}
                        >
                          Edit Branches
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        onClick={() => handleResetPassword(user)}
                      >
                        Reset Password
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start text-destructive"
                        onClick={() => handleDeleteUser(user)}
                        disabled={user.id === currentUser?.id}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add User Modal */}
      <AddUserModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />

      {/* Edit Branches Modal */}
      {selectedUser && (
        <EditBranchesModal
          user={selectedUser}
          open={isEditBranchesModalOpen}
          onOpenChange={setIsEditBranchesModalOpen}
        />
      )}

      {/* Reset Password Modal */}
      {selectedUser && (
        <ResetPasswordModal
          user={selectedUser}
          open={isResetPasswordModalOpen}
          onOpenChange={setIsResetPasswordModalOpen}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedUser?.name || selectedUser?.email}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}

          {showFallbackOption && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Fallback Option</AlertTitle>
              <AlertDescription>
                The user could not be deleted from the authentication system. You can still delete the user from the
                database only, but the auth record will remain.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2 sm:space-x-0">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>

            {showFallbackOption ? (
              <Button variant="destructive" onClick={useFallbackDelete}>
                Delete from Database Only
              </Button>
            ) : (
              <Button variant="destructive" onClick={confirmDeleteUser}>
                Delete User
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
