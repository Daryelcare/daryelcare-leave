"use client"

import { formatLocalDate } from "@/lib/dates"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  AlertCircle,
  Building2,
  KeyRound,
  MoreHorizontal,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRound,
} from "lucide-react"
import { Avatar, EmptyState, ErrorState, ListSkeleton, SectionHeader } from "./page-kit"
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
  } = useQuery<User[]>({
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

  const formatJoined = (value?: string) => formatLocalDate(value)

  const roleBadge = (role: string) =>
    role === "admin" ? (
      <Badge variant="default">Administrator</Badge>
    ) : (
      <Badge variant="secondary">Branch manager</Badge>
    )

  const branchList = (user: User) =>
    user.role === "admin" ? (
      <span className="text-sm text-muted-foreground">All branches</span>
    ) : user.branches && user.branches.length > 0 ? (
      <div className="flex flex-wrap gap-1">
        {user.branches.map((branch) => (
          <Badge key={branch} variant="outline" className="font-medium">
            {branch}
          </Badge>
        ))}
      </div>
    ) : (
      <span className="text-sm text-warning">No branches assigned</span>
    )

  const rowActions = (user: User) => {
    const isSelf = user.id === currentUser?.id
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <span className="sr-only">Actions for {user.name || user.email}</span>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {user.role === "normal" && (
            <DropdownMenuItem onClick={() => handleEditBranches(user)}>
              <Building2 />
              Edit branches
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => handleResetPassword(user)}>
            <KeyRound />
            Reset password
          </DropdownMenuItem>
          {!isSelf && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="pb-1 text-xs font-semibold text-muted-foreground">Role</DropdownMenuLabel>
              <DropdownMenuItem disabled={user.role === "admin"} onClick={() => handleRoleChange(user, "admin")}>
                <ShieldCheck />
                Make administrator
              </DropdownMenuItem>
              <DropdownMenuItem disabled={user.role === "normal"} onClick={() => handleRoleChange(user, "normal")}>
                <UserRound />
                Make branch manager
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isSelf}
            className="text-destructive focus:text-destructive [&_svg]:!text-destructive"
            onClick={() => handleDeleteUser(user)}
          >
            <Trash2 />
            {isSelf ? "Can't delete yourself" : "Delete user"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const admins = users.filter((u) => u.role === "admin").length

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Users & access"
        description="Who can sign in, their role, and which branches they manage."
        actions={
          <Button onClick={() => setIsAddModalOpen(true)}>
            <UserPlus />
            Add user
          </Button>
        }
      />

      {isError && <ErrorState title="Couldn't load users" message={handleApiError(error)} onRetry={() => refetch()} />}

      <div className="surface overflow-hidden">
        <div className="flex items-center gap-4 border-b border-border/70 px-4 py-3 text-sm text-muted-foreground sm:px-5">
          <span>
            <span className="font-semibold text-foreground tabular">{users.length}</span>{" "}
            {users.length === 1 ? "user" : "users"}
          </span>
          <span className="h-4 w-px bg-border" aria-hidden />
          <span>
            <span className="font-semibold text-foreground tabular">{admins}</span>{" "}
            {admins === 1 ? "administrator" : "administrators"}
          </span>
        </div>

        {/* Desktop and tablet */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Branches</TableHead>
                <TableHead className="hidden lg:table-cell">Added</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <TableRow key={index} className="hover:bg-transparent">
                    <TableCell colSpan={5} className="py-3.5">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="ml-auto h-4 w-1/3" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name || user.email} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">
                            {user.name || "—"}
                            {user.id === currentUser?.id && (
                              <span className="ml-2 text-xs font-medium text-muted-foreground">You</span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{roleBadge(user.role)}</TableCell>
                    <TableCell>{branchList(user)}</TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                      {formatJoined(user.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">{rowActions(user)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5}>
                    <EmptyState
                      icon={UserRound}
                      title="No users yet"
                      description="Add the first person who should be able to sign in."
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Phones */}
        <div className="md:hidden">
          {isLoading ? (
            <ListSkeleton rows={3} />
          ) : users.length > 0 ? (
            <ul className="divide-y divide-border/70">
              {users.map((user) => (
                <li key={user.id} className="space-y-3 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={user.name || user.email} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">
                        {user.name || "—"}
                        {user.id === currentUser?.id && (
                          <span className="ml-2 text-xs font-medium text-muted-foreground">You</span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    {rowActions(user)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-12">
                    {roleBadge(user.role)}
                    {user.role !== "admin" && branchList(user)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={UserRound} title="No users yet" />
          )}
        </div>
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
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedUser?.name || selectedUser?.email}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Couldn&apos;t delete this user</AlertTitle>
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}

          {showFallbackOption && (
            <Alert variant="warning">
              <AlertCircle />
              <AlertTitle>Remove from the app only?</AlertTitle>
              <AlertDescription>
                The user could not be deleted from the authentication system. You can still delete the user from the
                database only, but the auth record will remain.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>

            {showFallbackOption ? (
              <Button variant="destructive" onClick={useFallbackDelete}>
                Remove from app only
              </Button>
            ) : (
              <Button variant="destructive" onClick={confirmDeleteUser}>
                Delete user
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
