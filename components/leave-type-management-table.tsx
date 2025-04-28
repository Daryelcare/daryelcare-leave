"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Edit, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

  if (isLoadingLeaveTypes) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={handleAddLeaveType}
          className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Leave Type
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-center">Default Days</TableHead>
              <TableHead className="text-center">Settings</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaveTypes.map((leaveType: LeaveType) => (
              <TableRow key={leaveType.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: leaveType.color }} />
                    {leaveType.name}
                  </div>
                </TableCell>
                <TableCell>{leaveType.description}</TableCell>
                <TableCell className="text-center">{leaveType.defaultDays}</TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-wrap gap-1 justify-center">
                    {leaveType.isPaid && <Badge>Paid</Badge>}
                    {leaveType.requiresApproval && <Badge variant="outline">Approval Required</Badge>}
                    {leaveType.allowNegativeBalance && <Badge variant="secondary">Negative Balance</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={leaveType.isActive ? "success" : "destructive"}>
                    {leaveType.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="icon" onClick={() => handleEditLeaveType(leaveType)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleDeleteLeaveType(leaveType)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
        title="Delete Leave Type"
        description={`Are you sure you want to delete ${selectedLeaveType?.name}? This action cannot be undone.`}
      />
    </div>
  )
}
