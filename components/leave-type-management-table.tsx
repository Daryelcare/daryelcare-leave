"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState, ListSkeleton } from "./page-kit"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { useToast } from "@/hooks/use-toast"
import type { LeaveType } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { EditLeaveTypeModal } from "./edit-leave-type-modal"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"

export function LeaveTypeManagementTable() {
  const [selectedLeaveType, setSelectedLeaveType] = useState<LeaveType | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: leaveTypes = [], isLoading: isLoadingLeaveTypes } = useQuery({
    queryKey: ["leaveTypes"],
    queryFn: async () => {
      try {
        const response = await fetchWithAuth("/api/leave-types")
        return response || []
      } catch (error) {
        console.error("Error fetching leave types:", error)
        toast({
          title: "Error",
          description: `Failed to load leave types: ${handleApiError(error)}`,
          variant: "destructive",
        })
        return []
      }
    },
  })

  const handleAddLeaveType = () => {
    setSelectedLeaveType(null)
    setIsEditModalOpen(true)
  }

  const handleEditLeaveType = (leaveType: LeaveType) => {
    setSelectedLeaveType(leaveType)
    setIsEditModalOpen(true)
  }

  const handleDeleteLeaveType = (leaveType: LeaveType) => {
    setSelectedLeaveType(leaveType)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedLeaveType) return

    try {
      await fetchWithAuth(`/api/leave-types/${selectedLeaveType.id}`, {
        method: "DELETE",
      })

      toast({
        title: "Success",
        description: "Leave type deleted successfully",
      })

      queryClient.invalidateQueries({ queryKey: ["leaveTypes"] })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to delete leave type: ${handleApiError(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsDeleteDialogOpen(false)
      setSelectedLeaveType(null)
    }
  }

  return (
    <div className="surface overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-5 pb-4 sm:p-6 sm:pb-4">
        <div>
          <h2 className="text-[17px] font-semibold">Leave types</h2>
          <p className="text-sm text-muted-foreground">The kinds of leave that can be recorded, and their colour on the calendar.</p>
        </div>
        <Button onClick={handleAddLeaveType} className="shrink-0">
          <Plus />
          <span className="hidden sm:inline">Add leave type</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>
      {isLoadingLeaveTypes ? (
        <ListSkeleton rows={4} className="border-t border-border/70" />
      ) : leaveTypes.length === 0 ? (
        <EmptyState title="No leave types yet" className="border-t border-border/70" />
      ) : (
        <ul className="divide-y divide-border/70 border-t border-border/70">
          {leaveTypes.map((leaveType: LeaveType) => (
            <li key={leaveType.id} className="flex items-start gap-3 px-5 py-3.5 sm:items-center sm:px-6">
              <span
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:mt-0"
                style={{ backgroundColor: `${leaveType.color}1f` }}
                aria-hidden
              >
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: leaveType.color }} />
              </span>
              <div className="min-w-0 flex-1 space-y-1.5 sm:flex sm:items-center sm:gap-4 sm:space-y-0">
                <div className="min-w-0 sm:flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {leaveType.name}
                    {!leaveType.isActive && <Badge variant="secondary">Inactive</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{leaveType.description || "No description"}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:justify-end">
                  {(leaveType.defaultDays ?? 0) > 0 && <Badge variant="outline">{leaveType.defaultDays} days</Badge>}
                  <Badge variant={leaveType.isPaid ? "success" : "secondary"}>{leaveType.isPaid ? "Paid" : "Unpaid"}</Badge>
                  {leaveType.requiresApproval && <Badge variant="outline">Needs approval</Badge>}
                  {leaveType.allowNegativeBalance && <Badge variant="outline">Can go negative</Badge>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleEditLeaveType(leaveType)} aria-label={`Edit ${leaveType.name}`}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                  onClick={() => handleDeleteLeaveType(leaveType)}
                  aria-label={`Delete ${leaveType.name}`}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <EditLeaveTypeModal
        leaveType={selectedLeaveType}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["leaveTypes"] })}
      />

      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="Delete leave type"
        description={`Are you sure you want to delete ${selectedLeaveType?.name}? Existing leave entries keep their type name. This can't be undone.`}
      />
    </div>
  )
}
