"use client"

import { useState, useEffect, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { useLeaveTypes } from "@/hooks/use-leave-types"
import { cn } from "@/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useApp } from "./app-provider"
import type { Employee } from "@/lib/types"
import { EmployeePicker } from "./employee-picker"
import { type StoredPeriod, crossesLeaveYearEnd } from "@/lib/leave-years"
import { localDateToUtc, toUkDate } from "@/lib/dates"

// Form schema
const formSchema = z.object({
  employeeId: z.string().min(1, { message: "Employee is required" }),
  type: z.string().min(1, { message: "Leave type is required" }),
  startDate: z.date({ error: "Start date is required" }),
  endDate: z
    .date({ error: "End date is required" })
    .refine((date) => date instanceof Date && !isNaN(date.getTime()), { message: "End date is required" }),
  reason: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface AddLeaveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddLeaveModal({ open, onOpenChange }: AddLeaveModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user } = useApp()

  // Add state for overlap warning and confirmation counter
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null)
  const [overlapConfirmCount, setOverlapConfirmCount] = useState(0)
  const [selectedEmployee, setSelectedEmployee] = useState<{
    id: string
    name: string
    daysTaken: number
    daysRemaining: number
    pendingDays: number
    availableDays: number
  } | null>(null)

  // Recorded leave is approved straight away unless saved as pending (as in CarerHR)
  const [saveAs, setSaveAs] = useState<"Approved" | "Pending">("Approved")

  // Leave can't cross the end of a leave year: book each year's part separately
  const { data: periods = [] } = useQuery<StoredPeriod[]>({
    queryKey: ["leavePeriods"],
    queryFn: () => fetchWithAuth("/api/leave-periods"),
    enabled: open,
  })

  // Add state for exceeding balance warning and confirmation
  const [exceedingBalanceConfirmCount, setExceedingBalanceConfirmCount] = useState(0)

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: "",
      type: "",
      startDate: undefined,
      endDate: undefined,
      reason: "",
    },
  })

  // Add a global error handler for ResizeObserver errors
  useEffect(() => {
    // This prevents the "ResizeObserver loop limit exceeded" error
    const errorHandler = (event: ErrorEvent) => {
      if (
        event.message === "ResizeObserver loop completed with undelivered notifications." ||
        event.message === "ResizeObserver loop limit exceeded"
      ) {
        event.stopImmediatePropagation()
      }
    }

    window.addEventListener("error", errorHandler)

    return () => {
      window.removeEventListener("error", errorHandler)
    }
  }, [])

  // Fetch branches

  // Fetch ALL employees without pagination, filtered by user's branches for normal users
  const { data: employeesResponse = { data: [], total: 0 }, isLoading: isLoadingEmployees } = useQuery<{
    data: Employee[]
    total: number
  }>({
    queryKey: ["employees", "all", user?.role, user?.branches],
    queryFn: async () => {
      try {
        // Use a very large pageSize to ensure we get all employees in one request
        const params = new URLSearchParams()
        params.append("pageSize", "1000") // Set a very large page size to get all employees

        // For normal users, filter by their assigned branches
        if (user?.role === "normal" && user?.branches && user?.branches.length > 0) {
          params.append("branches", user.branches.join(","))
        }

        const response = await fetchWithAuth(`/api/employees?${params.toString()}`)
        return response || { data: [], total: 0 }
      } catch (error) {
        console.error("Error fetching employees:", error)
        return { data: [], total: 0 }
      }
    },
    enabled: open,
  })

  // Stable reference, so the effects below don't re-run on every render
  const employees = useMemo(() => employeesResponse?.data || [], [employeesResponse])

  // Watch for employee ID changes to update selected employee
  const employeeId = form.watch("employeeId")

  useEffect(() => {
    if (employeeId && employees.length > 0) {
      const employee = employees.find((emp) => emp.id === employeeId)
      if (employee) {
        // Fetch ALL pending leave requests for this employee (regardless of type)
        const fetchPendingRequests = async () => {
          try {
            const response = await fetchWithAuth(`/api/leave-requests?employeeId=${employee.id}&status=Pending`)
            if (response && Array.isArray(response)) {
              // Calculate total pending days across all leave types
              const pendingDays = response.reduce((total, request) => total + request.duration, 0)

              setSelectedEmployee({
                id: employee.id,
                name: employee.name,
                daysTaken: employee.daysTaken,
                daysRemaining: employee.daysRemaining,
                pendingDays: pendingDays,
                availableDays: employee.daysRemaining - pendingDays,
              })
            }
          } catch (error) {
            console.error("Error fetching pending requests:", error)
            // If there's an error, still set the employee data without pending days
            setSelectedEmployee({
              id: employee.id,
              name: employee.name,
              daysTaken: employee.daysTaken,
              daysRemaining: employee.daysRemaining,
              pendingDays: 0,
              availableDays: employee.daysRemaining,
            })
          }
        }

        fetchPendingRequests()
      }
    } else {
      setSelectedEmployee(null)
    }
  }, [employeeId, employees])

  // Add a function to check for overlapping leave periods
  const checkForOverlap = async (employeeId: string, startDate: Date, endDate: Date) => {
    try {
      const response = await fetchWithAuth(`/api/leave-requests?employeeId=${employeeId}`)
      const existingLeaves = response || []

      // Format dates for comparison
      const newStartDate = new Date(startDate)
      const newEndDate = new Date(endDate)

      // Reset start and end times to midnight for proper comparison
      newStartDate.setHours(0, 0, 0, 0)
      newEndDate.setHours(0, 0, 0, 0)

      for (const leave of existingLeaves) {
        try {
          // Parse existing leave dates more safely
          const dateParts = leave.startDate.split("/")
          const existingStartDate = new Date(
            Number.parseInt(dateParts[2]), // year
            Number.parseInt(dateParts[1]) - 1, // month (0-indexed)
            Number.parseInt(dateParts[0]), // day
          )

          const endDateParts = leave.endDate.split("/")
          const existingEndDate = new Date(
            Number.parseInt(endDateParts[2]), // year
            Number.parseInt(endDateParts[1]) - 1, // month (0-indexed)
            Number.parseInt(endDateParts[0]), // day
          )

          // Check for overlap
          if (
            (newStartDate <= existingEndDate && newStartDate >= existingStartDate) ||
            (newEndDate <= existingEndDate && newEndDate >= existingStartDate) ||
            (newStartDate <= existingStartDate && newEndDate >= existingEndDate)
          ) {
            return {
              hasOverlap: true,
              message: `This leave overlaps with an existing leave from ${leave.startDate} to ${leave.endDate}`,
            }
          }
        } catch (parseError) {
          console.error("Error parsing date:", parseError)
          continue // Skip this leave if date parsing fails
        }
      }

      return { hasOverlap: false, message: null }
    } catch (error) {
      console.error("Error checking for overlap:", error)
      return { hasOverlap: false, message: null }
    }
  }

  // Update the watch for employeeId, startDate, and endDate to check for overlap
  const startDate = form.watch("startDate")
  const endDate = form.watch("endDate")

  // Add useEffect to check for overlap when dates or employee changes
  useEffect(() => {
    let isMounted = true

    const checkOverlap = async () => {
      if (!employeeId || !startDate || !endDate) {
        if (isMounted) {
          setOverlapWarning(null)
        }
        return
      }

      const { message } = await checkForOverlap(employeeId, startDate, endDate)

      // Only update state if component is still mounted
      if (isMounted) {
        // If overlap status changes, reset the confirmation counter
        if ((message && !overlapWarning) || (!message && overlapWarning)) {
          setOverlapConfirmCount(0)
        }

        setOverlapWarning(message)
      }
    }

    // Debounce the checkOverlap function
    const timeoutId = setTimeout(() => {
      checkOverlap()
    }, 300)

    // Cleanup function
    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [employeeId, startDate, endDate, overlapWarning])

  // Reset overlap confirm count when modal closes
  useEffect(() => {
    if (!open) {
      setOverlapConfirmCount(0)
      setOverlapWarning(null)
      setExceedingBalanceConfirmCount(0)
      form.reset()
      setSelectedEmployee(null)
    }
  }, [open, form])

  // Calculate duration in days
  let duration = 0
  if (startDate && endDate) {
    // Calculate the difference in days
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
    duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1 // +1 to include both start and end days
  }

  const crossesYear =
    startDate && endDate ? crossesLeaveYearEnd(periods, localDateToUtc(startDate), localDateToUtc(endDate)) : null

  // Check if the requested leave exceeds the employee's remaining days
  // This now applies to ALL leave types, not just Annual
  const isExceedingBalance = selectedEmployee && duration > selectedEmployee.availableDays

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    if (crossesYear) return
    // If there's an overlap warning and the confirm count is less than 3
    if (overlapWarning && overlapConfirmCount < 2) {
      // Increment the confirm count
      setOverlapConfirmCount((prev) => prev + 1)
      return
    }

    // If exceeding balance and not confirmed yet
    if (isExceedingBalance && exceedingBalanceConfirmCount < 1) {
      setExceedingBalanceConfirmCount((prev) => prev + 1)
      return
    }

    setIsSubmitting(true)
    try {
      // Find the selected employee to get their name and branch
      const selectedEmployee = employees.find((emp) => emp.id === data.employeeId)

      if (!selectedEmployee) {
        throw new Error("Selected employee not found")
      }

      // For normal users, verify they have access to the employee's branch
      if (user?.role === "normal" && user?.branches) {
        if (!user.branches.includes(selectedEmployee.branch)) {
          throw new Error("You don't have permission to add leave for this employee")
        }
      }

      const leaveData = {
        employeeId: data.employeeId,
        employee: selectedEmployee.name,
        branch: selectedEmployee.branch,
        type: data.type,
        startDate: format(data.startDate, "dd/MM/yyyy"),
        endDate: format(data.endDate, "dd/MM/yyyy"),
        duration: duration,
        reason: data.reason,
        status: saveAs,
        addedBy: user?.name || "", // Use the user's name instead of "System"
      }

      await fetchWithAuth("/api/leave-requests", {
        method: "POST",
        body: JSON.stringify(leaveData),
      })

      toast({
        title: saveAs === "Pending" ? "Leave saved as pending" : "Leave added",
        description:
          saveAs === "Pending"
            ? "It's waiting for a decision on the Leave page."
            : `${selectedEmployee.name}'s leave is approved.`,
      })
      setSaveAs("Approved")

      // Reset form
      form.reset()
      setOverlapConfirmCount(0)
      setExceedingBalanceConfirmCount(0)
      setSelectedEmployee(null)

      // Close modal
      onOpenChange(false)

      // Refresh leave requests list
      queryClient.invalidateQueries({ queryKey: ["leaveRequests"] })
      queryClient.invalidateQueries({ queryKey: ["leaveRequestsAll"] })
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["leave-calendar"] })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to add leave request: ${handleApiError(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get the appropriate warning message based on overlap and confirm count
  const getOverlapMessage = () => {
    if (!overlapWarning) return null

    if (overlapConfirmCount === 0) {
      return `⚠️ Warning: ${overlapWarning}. Click submit 3 times to confirm.`
    } else if (overlapConfirmCount === 1) {
      return `⚠️ Warning: ${overlapWarning}. Click submit 2 more times to confirm.`
    } else {
      return `⚠️ Warning: ${overlapWarning}. Click submit 1 more time to confirm.`
    }
  }

  // Get the exceeding balance message
  const getExceedingBalanceMessage = () => {
    if (!isExceedingBalance) return null

    if (exceedingBalanceConfirmCount === 0) {
      return `⚠️ Warning: This request exceeds the available leave balance by ${duration - (selectedEmployee?.availableDays || 0)} days. Click submit again to confirm.`
    } else {
      return `⚠️ Warning: This request exceeds the available leave balance by ${duration - (selectedEmployee?.availableDays || 0)} days. The employee will have a negative balance.`
    }
  }

  // Get the submit button text based on warnings and confirm counts
  const getSubmitButtonText = () => {
    if (isSubmitting) return "Saving…"
    if (saveAs === "Pending" && !overlapWarning && !isExceedingBalance) return "Save as pending"

    if (overlapWarning) {
      if (overlapConfirmCount === 0) {
        return "Confirm overlap (1/3)"
      } else if (overlapConfirmCount === 1) {
        return "Confirm overlap (2/3)"
      } else {
        return "Confirm overlap (3/3)"
      }
    }

    if (isExceedingBalance) {
      if (exceedingBalanceConfirmCount === 0) {
        return "Confirm negative balance"
      } else {
        return "Add leave"
      }
    }

    return "Add leave"
  }

  // Add the leave types query
  const { data: leaveTypes = [], isLoading: isLoadingLeaveTypes } = useLeaveTypes()

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        // If closing, reset state with a small delay to prevent ResizeObserver issues
        if (!newOpen) {
          setTimeout(() => {
            setOverlapConfirmCount(0)
            setOverlapWarning(null)
            setExceedingBalanceConfirmCount(0)
          }, 0)
        }
        onOpenChange(newOpen)
      }}
    >
      <DialogContent
        className="sm:max-w-[550px]"
        // Focus the dialog itself, so the employee list doesn't pop open on arrival
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement | null)?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Add leave</DialogTitle>
          <DialogDescription>Record leave for an employee: approve it now or save it as pending.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee</FormLabel>
                  <FormControl>
                    <EmployeePicker
                      employees={employees}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={isLoadingEmployees}
                      placeholder={isLoadingEmployees ? "Loading employees…" : "Search by name, branch or code"}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Leave type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingLeaveTypes}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select leave type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {leaveTypes.map((leaveType) => (
                        <SelectItem key={leaveType.id} value={leaveType.name}>
                          {leaveType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start date</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End date</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value} onChange={field.onChange} min={startDate} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {selectedEmployee && (
              <div className="overflow-hidden rounded-xl border border-border/80 bg-muted/40 text-sm">
                <div className="grid grid-cols-3 divide-x divide-border/70">
                  {[
                    { label: "Duration", value: startDate && endDate ? duration : "—" },
                    { label: "Available", value: selectedEmployee.availableDays },
                    {
                      label: "After this",
                      value: startDate && endDate && duration > 0 ? selectedEmployee.availableDays - duration : "—",
                      danger: startDate && endDate && duration > 0 && selectedEmployee.availableDays - duration < 0,
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="px-3 py-3 text-center">
                      <p
                        className={cn(
                          "font-display text-xl font-semibold tracking-[-0.02em] tabular",
                          stat.danger && "text-destructive",
                        )}
                      >
                        {stat.value}
                      </p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
                <p className="border-t border-border/70 px-3.5 py-2.5 text-xs text-muted-foreground">
                  {selectedEmployee.name} has used {selectedEmployee.daysTaken} and has {selectedEmployee.daysRemaining}{" "}
                  days remaining
                  {selectedEmployee.pendingDays > 0 && ` (${selectedEmployee.pendingDays} pending)`}. Only Annual Leave
                  and Working Holiday use the balance.
                </p>
              </div>
            )}

            {!selectedEmployee && startDate && endDate && (
              <p className="rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm font-medium">
                {duration} {duration === 1 ? "day" : "days"}
              </p>
            )}

            {selectedEmployee && isExceedingBalance && (
              <Alert variant={exceedingBalanceConfirmCount === 0 ? "warning" : "destructive"}>
                <AlertCircle />
                <AlertTitle>More than the available balance</AlertTitle>
                <AlertDescription>{(getExceedingBalanceMessage() || "").replace(/^⚠️ Warning: /, "")}</AlertDescription>
              </Alert>
            )}

            {overlapWarning && (
              <Alert variant={overlapConfirmCount >= 2 ? "destructive" : "warning"}>
                <AlertTriangle />
                <AlertTitle>Overlaps existing leave</AlertTitle>
                <AlertDescription>{(getOverlapMessage() || "").replace(/^⚠️ Warning: /, "")}</AlertDescription>
              </Alert>
            )}

            {crossesYear && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Crosses the end of the leave year</AlertTitle>
                <AlertDescription>
                  Leave can&apos;t run past {toUkDate(crossesYear.end)}. Add it as two entries: one up to{" "}
                  {toUkDate(crossesYear.end)} and one from the next day.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <p className="text-sm font-medium">Status</p>
              <div
                role="radiogroup"
                aria-label="Save as"
                className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1"
              >
                {(
                  [
                    { value: "Approved", label: "Approve now" },
                    { value: "Pending", label: "Save as pending" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={saveAs === o.value}
                    onClick={() => setSaveAs(o.value)}
                    className={cn(
                      "h-9 rounded-lg text-sm font-semibold transition-colors",
                      saveAs === o.value
                        ? "bg-card text-foreground shadow-raised"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {saveAs === "Approved"
                  ? "Approved leave uses the balance straight away (Annual Leave and Working Holiday)."
                  : "Pending leave waits for a decision and only uses the balance once approved."}
              </p>
            </div>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Reason <span className="font-normal text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide details about the leave request"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !!crossesYear}
                variant={overlapWarning && overlapConfirmCount >= 2 ? "destructive" : "default"}
                className={cn(
                  ((overlapWarning && overlapConfirmCount < 2) ||
                    (isExceedingBalance && exceedingBalanceConfirmCount === 0)) &&
                    "bg-warning text-white hover:bg-warning/90",
                )}
              >
                {getSubmitButtonText()}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
