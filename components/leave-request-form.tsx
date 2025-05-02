
"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { CalendarIcon, InfoIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { useApp } from "./app-provider"
import { fetchWithAuth } from "@/lib/api-utils"
import { submitLeaveRequest } from "@/app/actions/leave-actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Helper function to check if a leave type should affect the days balance
function shouldDeductFromBalance(leaveType: string): boolean {
  // Only "Annual Leave" and "Working Holiday" should deduct from the 28 days balance
  return leaveType === "Annual Leave" || leaveType === "Working Holiday"
}

export function LeaveRequestForm() {
  const router = useRouter()
  const { user } = useApp()
  const { toast } = useToast()
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [leaveType, setLeaveType] = useState<string>("")
  const [reason, setReason] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [exceedingBalanceConfirm, setExceedingBalanceConfirm] = useState<boolean>(false)
  const [employeeData, setEmployeeData] = useState<{
    id: string
    name: string
    branch: string
    daysTaken: number
    daysRemaining: number
    pendingDays: number
    availableDays: number
  } | null>(null)

  // Calculate duration in days
  const duration =
    startDate && endDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 0

  // Fetch employee data (in a real app, this would be based on the current user)
  const fetchPendingRequests = async (employeeId: string) => {
    try {
      // Fetch ALL pending requests regardless of type
      const response = await fetchWithAuth(`/api/leave-requests?employeeId=${employeeId}&status=Pending`)
      if (response && Array.isArray(response)) {
        // Calculate total pending days for leave types that affect the balance
        const pendingDays = response.reduce((total, request) => {
          if (shouldDeductFromBalance(request.type)) {
            return total + request.duration
          }
          return total
        }, 0)
        return pendingDays
      }
      return 0
    } catch (error) {
      console.error("Error fetching pending requests:", error)
      return 0
    }
  }

  useEffect(() => {
    const fetchEmployeeData = async () => {
      try {
        // In a real app, you would fetch the employee data based on the current user
        // For now, we'll just fetch the first employee
        const response = await fetchWithAuth("/api/employees?page=0&pageSize=1")
        if (response && response.data && response.data.length > 0) {
          const employee = response.data[0]

          // Fetch pending leave requests
          const pendingDays = await fetchPendingRequests(employee.id)

          setEmployeeData({
            id: employee.id,
            name: employee.name,
            branch: employee.branch,
            daysTaken: employee.daysTaken,
            daysRemaining: employee.daysRemaining,
            pendingDays: pendingDays,
            availableDays: employee.daysRemaining - pendingDays,
          })
        }
      } catch (error) {
        console.error("Error fetching employee data:", error)
      }
    }

    if (user) {
      fetchEmployeeData()
    }
  }, [user])

  // Check if exceeding allocation (only if the leave type deducts from balance)
  const willDeductFromBalance = leaveType ? shouldDeductFromBalance(leaveType) : false
  const isExceedingBalance = employeeData && willDeductFromBalance && duration > employeeData.availableDays

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!startDate || !endDate || !leaveType) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    if (!employeeData) {
      toast({
        title: "Error",
        description: "Employee data not available",
        variant: "destructive",
      })
      return
    }

    // Check if exceeding allocation and not confirmed yet
    if (isExceedingBalance && !exceedingBalanceConfirm) {
      setExceedingBalanceConfirm(true)
      return
    }

    setIsSubmitting(true)

    try {
      // Create form data
      const formData = new FormData()
      formData.append("employeeId", employeeData.id)
      formData.append("employee", employeeData.name)
      formData.append("branch", employeeData.branch)
      formData.append("type", leaveType)
      formData.append("startDate", format(startDate, "dd/MM/yyyy"))
      formData.append("endDate", format(endDate, "dd/MM/yyyy"))
      formData.append("reason", reason)
      formData.append("addedBy", user?.name || "System")

      // Submit the form using the server action
      const result = await submitLeaveRequest(formData)

      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        })

        // Reset form
        setStartDate(undefined)
        setEndDate(undefined)
        setLeaveType("")
        setReason("")
        setExceedingBalanceConfirm(false)

        // Refresh the page to show the updated leave requests
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request Leave</CardTitle>
        <CardDescription>Submit a new leave request</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Leave Type</label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <InfoIcon className="h-3 w-3 mr-1" />
                      <span>Only "Annual Leave" and "Working Holiday" deduct from balance</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Only "Annual Leave" and "Working Holiday" will deduct days from your 28-day annual leave balance.
                      Other leave types won't affect your leave balance.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger>
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Annual Leave">Annual Leave {shouldDeductFromBalance("Annual Leave") && "🔹"}</SelectItem>
                <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                <SelectItem value="Personal Leave">Personal Leave</SelectItem>
                <SelectItem value="Working Holiday">Working Holiday {shouldDeductFromBalance("Working Holiday") && "🔹"}</SelectItem>
                <SelectItem value="Maternity Leave">Maternity Leave</SelectItem>
                <SelectItem value="Working Unpaid">Working Unpaid</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            {leaveType && (
              <div className="text-xs mt-1">
                {shouldDeductFromBalance(leaveType) ? (
                  <span className="text-blue-600">This leave type will deduct from your 28-day balance.</span>
                ) : (
                  <span className="text-green-600">This leave type will NOT deduct from your 28-day balance.</span>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => (startDate ? date < startDate : false)} // Only restrict dates before start date
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {startDate && endDate && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-medium">Duration: {duration} days</p>
            </div>
          )}

          {employeeData && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-medium">
                Your Total Leave Balance: {employeeData.daysTaken} used, {employeeData.daysRemaining} total remaining
              </p>
              {employeeData.pendingDays > 0 && (
                <p className="text-sm font-medium mt-1">
                  Pending requests: {employeeData.pendingDays} days ({employeeData.availableDays} days available)
                </p>
              )}
              {startDate && endDate && duration > 0 && leaveType && shouldDeductFromBalance(leaveType) ? (
                <p className="text-sm font-medium mt-1">
                  After this request: {employeeData.availableDays - duration} days remaining
                  {employeeData.availableDays - duration < 0 && (
                    <span className="text-amber-600"> (negative balance)</span>
                  )}
                </p>
              ) : (
                <p className="text-sm font-medium mt-1">Currently available: {employeeData.availableDays} days</p>
              )}
              {leaveType && !shouldDeductFromBalance(leaveType) && (
                <p className="text-sm font-medium mt-1 text-green-600">
                  This leave type will NOT deduct from your balance.
                </p>
              )}
            </div>
          )}

          {isExceedingBalance && (
            <Alert variant={exceedingBalanceConfirm ? "warning" : "destructive"}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Exceeding Leave Balance</AlertTitle>
              <AlertDescription>
                {exceedingBalanceConfirm
                  ? `This request will result in a negative leave balance of ${employeeData!.availableDays - duration} days.`
                  : `This request exceeds your available leave balance by ${duration - employeeData!.availableDays} days. Click submit again to confirm.`}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Reason (Optional)</label>
            <Textarea
              placeholder="Provide details about your leave request"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="resize-none"
            />
          </div>
        </form>
      </CardContent>
      <CardFooter>
        <Button
          type="submit"
          onClick={handleSubmit}
          disabled={isSubmitting || !startDate || !endDate || !leaveType}
          className={cn(
            "w-full bg-gradient-to-r",
            isExceedingBalance && !exceedingBalanceConfirm
              ? "from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600"
              : "from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600",
          )}
        >
          {isSubmitting
            ? "Submitting..."
            : isExceedingBalance && !exceedingBalanceConfirm
              ? "Confirm Negative Balance"
              : "Submit Request"}
        </Button>
      </CardFooter>
    </Card>
  )
}
