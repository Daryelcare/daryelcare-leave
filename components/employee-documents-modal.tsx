"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useQuery } from "@tanstack/react-query"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Upload } from "lucide-react"
import type { EmployeeDocument } from "@/lib/types"

interface EmployeeDocumentsModalProps {
  employeeId: string
  employeeName: string
  isOpen: boolean
  onClose: () => void
}

export function EmployeeDocumentsModal({ employeeId, employeeName, isOpen, onClose }: EmployeeDocumentsModalProps) {
  const {
    data: documents = [],
    isLoading,
    isError,
    error,
  } = useQuery<EmployeeDocument[]>({
    queryKey: ["employeeDocuments", employeeId],
    queryFn: async () => {
      return fetchWithAuth(`/api/documents?employeeId=${employeeId}`)
    },
    enabled: isOpen && !!employeeId,
  })

  // Function to determine status color
  const getStatusColor = (daysLeft: number) => {
    if (daysLeft <= 0) return "text-red-500"
    if (daysLeft <= 30) return "text-orange-500"
    if (daysLeft <= 90) return "text-yellow-500"
    return "text-green-500"
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Documents - {employeeName}</DialogTitle>
        </DialogHeader>

        <div className="flex justify-end mb-4">
          <Button className="gap-2 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600">
            <Upload className="h-4 w-4" />
            Upload Document
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="text-destructive">Error loading documents: {handleApiError(error)}</div>
        ) : documents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="py-2 px-4 text-left">Document Type</th>
                  <th className="py-2 px-4 text-left">Country</th>
                  <th className="py-2 px-4 text-left">Passport Expiry</th>
                  <th className="py-2 px-4 text-left">Right to Work Expiry</th>
                  <th className="py-2 px-4 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-4 capitalize">{doc.documentType}</td>
                    <td className="py-2 px-4">{doc.country}</td>
                    <td className="py-2 px-4">
                      <div>{doc.passportExpiry}</div>
                      <div className={`text-sm ${getStatusColor(doc.passportDaysLeft)}`}>
                        {doc.passportDaysLeft} days left
                      </div>
                    </td>
                    <td className="py-2 px-4">
                      <div>{doc.rightToWorkExpiry}</div>
                      <div className={`text-sm ${getStatusColor(doc.rightToWorkDaysLeft)}`}>
                        {doc.rightToWorkDaysLeft} days left
                      </div>
                    </td>
                    <td className="py-2 px-4 capitalize">{doc.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No documents found for this employee
            <div className="mt-4">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add First Document
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
