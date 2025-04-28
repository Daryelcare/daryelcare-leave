"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, CalendarIcon, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
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
import { useBranches } from "@/hooks/use-branches"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useApp } from "./app-provider"

// Form schema
const formSchema = z.object({
  employeeId: z.string().min(1, { message: "Employee is required" }),
  type: z.string().min(1, { message: "Leave type is required" }),
  startDate: z.date({ required_error: "Start date is required" }),
  endDate: z
    .date({ required_error: "End date is required" })
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
  const { data: branches = [], isLoading: isLoadingBranches } = useBranches()

  // Fetch ALL employees without pagination, filtered by user's branches for normal users
  const { data: employeesResponse = { data: [], total: 0 }, isLoading: isLoadingEmployees } = useQuery({
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

  const employees = employeesResponse?.data || []

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
  const leaveType = form.watch("type")

  // Add useEffect to check for overlap when dates or employee changes
  useEffect(() => {
    let isMounted = true
    let timeoutId: NodeJS.Timeout

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
    timeoutId = setTimeout(() => {
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

  // Check if the requested leave exceeds the employee's remaining days
  // This now applies to ALL leave types, not just Annual
  const isExceedingBalance = selectedEmployee && duration > selectedEmployee.availableDays

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
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
        status: "Approved",
        addedBy: user?.name || "", // Use the user's name instead of "System"
      }

      await fetchWithAuth("/api/leave-requests", {
        method: "POST",
        body: JSON.stringify(leaveData),
      })

      toast({
        title: "Success",
        description: "Leave request added successfully",
      })

      // Reset form
      form.reset()
      setOverlapConfirmCount(0)
      setExceedingBalanceConfirmCount(0)
      setSelectedEmployee(null)

      // Close modal
      onOpenChange(false)

      // Refresh leave requests list
      queryClient.invalidateQueries({ queryKey: ["leaveRequests"] })
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
    if (isSubmitting) return "Submitting..."

    if (overlapWarning) {
      if (overlapConfirmCount === 0) {
        return "Confirm Overlap (1/3)"
      } else if (overlapConfirmCount === 1) {
        return "Confirm Overlap (2/3)"
      } else {
        return "Confirm Overlap (3/3)"
      }
    }

    if (isExceedingBalance) {
      if (exceedingBalanceConfirmCount === 0) {
        return "Confirm Negative Balance"
      } else {
        return "Submit Request"
      }
    }

    return "Submit Request"
  }

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
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Add Leave Request</DialogTitle>
          <DialogDescription>Create a new leave request for an employee.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingEmployees}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an employee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[300px]">
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name} ({employee.branch})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Leave Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select leave type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Annual">Annual Leave</SelectItem>
                      <SelectItem value="Sick">Sick Leave</SelectItem>
                      <SelectItem value="Personal">Personal Leave</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          key="start-date-calendar"
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            // Add a small delay to prevent rapid DOM updates
                            setTimeout(() => field.onChange(date), 0)
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          key="end-date-calendar"
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            // Add a small delay to prevent rapid DOM updates
                            setTimeout(() => field.onChange(date), 0)
                          }}
                          disabled={(date) => (startDate ? date < startDate : false)} // Only restrict dates before start date
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {startDate && endDate && (
              <div className="rounded-md bg-muted p-3">
                <p className="text-sm font-medium">Duration: {duration} days</p>
              </div>
            )}

            {selectedEmployee && (
              <div className="rounded-md bg-muted p-3">
                <p className="text-sm font-medium">Employee: {selectedEmployee.name}</p>
                <p className="text-sm font-medium">
                  Total Leave Balance: {selectedEmployee.daysTaken} used, {selectedEmployee.daysRemaining} remaining
                </p>
                {selectedEmployee.pendingDays > 0 && (
                  <p className="text-sm font-medium mt-1">
                    Pending requests: {selectedEmployee.pendingDays} days ({selectedEmployee.availableDays} days
                    available)
                  </p>
                )}
                {startDate && endDate && duration > 0 ? (
                  <p className="text-sm font-medium mt-1">
                    After this request: {selectedEmployee.availableDays - duration} days remaining
                    {selectedEmployee.availableDays - duration < 0 && (
                      <span className="text-amber-600"> (negative balance)</span>
                    )}
                  </p>
                ) : (
                  <p className="text-sm font-medium mt-1">Currently available: {selectedEmployee.availableDays} days</p>
                )}
              </div>
            )}

            {selectedEmployee && isExceedingBalance && (
              <Alert variant={exceedingBalanceConfirmCount === 0 ? "destructive" : "warning"}>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Exceeding Leave Balance</AlertTitle>
                <AlertDescription>{getExceedingBalanceMessage()}</AlertDescription>
              </Alert>
            )}

            {overlapWarning && (
              <div
                className={cn(
                  "rounded-md p-3 border flex items-start gap-2",
                  overlapConfirmCount === 0
                    ? "bg-yellow-50 border-yellow-200"
                    : overlapConfirmCount === 1
                      ? "bg-orange-50 border-orange-200"
                      : "bg-red-50 border-red-200",
                )}
              >
                <AlertTriangle
                  className={cn(
                    "h-5 w-5 mt-0.5",
                    overlapConfirmCount === 0
                      ? "text-yellow-600"
                      : overlapConfirmCount === 1
                        ? "text-orange-600"
                        : "text-red-600",
                  )}
                />
                <p
                  className={cn(
                    "text-sm font-medium",
                    overlapConfirmCount === 0
                      ? "text-yellow-800"
                      : overlapConfirmCount === 1
                        ? "text-orange-800"
                        : "text-red-800",
                  )}
                >
                  {getOverlapMessage()}
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (Optional)</FormLabel>
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
                disabled={isSubmitting}
                className={cn(
                  "bg-gradient-to-r",
                  overlapWarning
                    ? overlapConfirmCount === 0
                      ? "from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600"
                      : overlapConfirmCount === 1
                        ? "from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                        : "from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
                    : isExceedingBalance && exceedingBalanceConfirmCount === 0
                      ? "from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600"
                      : "from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600",
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
