"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useQuery } from "@tanstack/react-query"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import type { Employee } from "@/lib/types"
import { Avatar, ErrorState, Field } from "./page-kit"

interface EmployeeDetailsModalProps {
  employeeId: string
  isOpen: boolean
  onClose: () => void
}

export function EmployeeDetailsModal({ employeeId, isOpen, onClose }: EmployeeDetailsModalProps) {
  const {
    data: employee,
    isLoading,
    isError,
    error,
  } = useQuery<Employee>({
    queryKey: ["employee", employeeId],
    queryFn: async () => {
      return fetchWithAuth(`/api/employees/${employeeId}`)
    },
    enabled: isOpen && !!employeeId,
  })

  const days = employee?.daysRemaining ?? 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader className="sr-only">
          <DialogTitle>Employee details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : isError ? (
          <ErrorState title="Couldn't load this employee" message={handleApiError(error)} />
        ) : employee ? (
          <div className="space-y-5">
            <div className="flex items-center gap-4 pr-8">
              <Avatar name={employee.name} className="h-14 w-14 text-lg" />
              <div className="min-w-0">
                <p className="truncate font-display text-xl font-semibold tracking-[-0.02em]">{employee.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {employee.jobTitle} · {employee.branch}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-border/70 rounded-xl border border-border/80 bg-muted/40">
              {[
                { label: "Remaining", value: days, tone: days < 0 ? "text-destructive" : days <= 5 ? "text-warning" : "text-foreground" },
                { label: "Taken", value: employee.daysTaken, tone: "text-foreground" },
                { label: "Hours / wk", value: employee.hours ?? "—", tone: "text-foreground" },
              ].map((stat) => (
                <div key={stat.label} className="px-3 py-3.5 text-center">
                  <p className={`font-display text-2xl font-semibold tracking-[-0.03em] tabular ${stat.tone}`}>{stat.value}</p>
                  <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Field label="Employee code">{employee.employeeCode}</Field>
              <Field label="Status">
                <Badge variant={employee.status === "active" ? "success" : "secondary"} dot>
                  {employee.status === "active" ? "Active" : "Inactive"}
                </Badge>
              </Field>
              <Field label="Email">{employee.email || "—"}</Field>
              <Field label="Phone">{employee.phone || "—"}</Field>
            </dl>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
