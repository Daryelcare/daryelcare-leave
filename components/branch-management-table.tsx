"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Building2, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { EmptyState, ErrorState, ListSkeleton } from "./page-kit"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Branch } from "@/lib/types"

// Form schema
const formSchema = z.object({
  name: z.string().min(2, { message: "Branch name must be at least 2 characters." }),
})

type FormValues = z.infer<typeof formSchema>

export function BranchManagementTable() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null)

  // Fetch branches
  const {
    data: branches = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      return fetchWithAuth("/api/branches")
    },
  })

  // Form for add/edit
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  })

  // Reset form when modal opens/closes
  const resetForm = () => {
    form.reset()
    setSelectedBranch(null)
  }

  // Add branch
  const addBranch = async (data: FormValues) => {
    try {
      await fetchWithAuth("/api/branches", {
        method: "POST",
        body: JSON.stringify(data),
      })

      toast({
        title: "Success",
        description: "Branch added successfully",
      })

      setIsAddModalOpen(false)
      resetForm()
      queryClient.invalidateQueries({ queryKey: ["branches"] })
    } catch (error) {
      toast({
        title: "Error",
        description: handleApiError(error),
        variant: "destructive",
      })
    }
  }

  // Edit branch
  const editBranch = async (data: FormValues) => {
    if (!selectedBranch) return

    try {
      await fetchWithAuth(`/api/branches/${selectedBranch.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      })

      toast({
        title: "Success",
        description: "Branch updated successfully",
      })

      setIsEditModalOpen(false)
      resetForm()
      queryClient.invalidateQueries({ queryKey: ["branches"] })
    } catch (error) {
      toast({
        title: "Error",
        description: handleApiError(error),
        variant: "destructive",
      })
    }
  }

  // Delete branch
  const deleteBranch = async (id: string) => {
    try {
      await fetchWithAuth(`/api/branches/${id}`, {
        method: "DELETE",
      })

      toast({
        title: "Success",
        description: "Branch deleted successfully",
      })

      queryClient.invalidateQueries({ queryKey: ["branches"] })
    } catch (error) {
      toast({
        title: "Error",
        description: handleApiError(error),
        variant: "destructive",
      })
    }
  }

  // Handle edit click
  const handleEditClick = (branch: Branch) => {
    setSelectedBranch(branch)
    form.setValue("name", branch.name)
    setIsEditModalOpen(true)
  }

  return (
    <div className="surface overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-5 pb-4 sm:p-6 sm:pb-4">
        <div>
          <h2 className="text-[17px] font-semibold">All branches</h2>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Loading…" : `${branches.length} ${branches.length === 1 ? "branch" : "branches"}. Used to group staff and manager access.`}
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="shrink-0">
          <Plus />
          <span className="hidden sm:inline">Add branch</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {isError ? (
        <ErrorState title="Couldn't load branches" message={handleApiError(error)} className="mx-5 mb-5 sm:mx-6" />
      ) : isLoading ? (
        <ListSkeleton rows={3} className="border-t border-border/70" />
      ) : branches.length === 0 ? (
        <EmptyState icon={Building2} title="No branches yet" description="Add your first branch to start organising staff." className="border-t border-border/70" />
      ) : (
        <ul className="divide-y divide-border/70 border-t border-border/70">
          {branches.map((branch: Branch) => (
            <li key={branch.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Building2 className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{branch.name}</p>
                <p className="text-xs text-muted-foreground">
                  Added {branch.created_at ? new Date(branch.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleEditClick(branch)}>
                <Pencil />
                <span className="hidden sm:inline">Rename</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                onClick={() => setBranchToDelete(branch)}
                aria-label={`Delete ${branch.name}`}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <DeleteConfirmationDialog
        isOpen={!!branchToDelete}
        onClose={() => setBranchToDelete(null)}
        onConfirm={() => {
          if (branchToDelete) deleteBranch(branchToDelete.id)
          setBranchToDelete(null)
        }}
        title="Delete branch"
        description={`Delete ${branchToDelete?.name}? Staff and managers assigned to it keep the branch name, but it won't appear in lists. This can't be undone.`}
        confirmLabel="Delete branch"
        cancelLabel="Cancel"
      />

      {/* Add Branch Modal */}
      <Dialog
        open={isAddModalOpen}
        onOpenChange={(open) => {
          setIsAddModalOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add branch</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(addBranch)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Lambeth" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add branch</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Branch Modal */}
      <Dialog
        open={isEditModalOpen}
        onOpenChange={(open) => {
          setIsEditModalOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename branch</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(editBranch)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Lambeth" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
