import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type LeaveStatus = "approved" | "pending" | "rejected"

type LeaveRequest = {
  id: string
  type: string
  startDate: string
  endDate: string
  days: number
  status: LeaveStatus
}

export function UpcomingLeaves() {
  // Mock data - in a real app, this would come from an API
  const leaveRequests: LeaveRequest[] = [
    {
      id: "1",
      type: "Annual Leave",
      startDate: "May 15, 2025",
      endDate: "May 20, 2025",
      days: 6,
      status: "approved",
    },
    {
      id: "2",
      type: "Sick Leave",
      startDate: "Jun 5, 2025",
      endDate: "Jun 6, 2025",
      days: 2,
      status: "pending",
    },
    {
      id: "3",
      type: "Personal Leave",
      startDate: "Jul 10, 2025",
      endDate: "Jul 10, 2025",
      days: 1,
      status: "rejected",
    },
  ]

  const getStatusColor = (status: LeaveStatus) => {
    switch (status) {
      case "approved":
        return "bg-green-500 hover:bg-green-600"
      case "pending":
        return "bg-yellow-500 hover:bg-yellow-600"
      case "rejected":
        return "bg-red-500 hover:bg-red-600"
      default:
        return "bg-gray-500 hover:bg-gray-600"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Leaves</CardTitle>
        <CardDescription>Your scheduled and pending leave requests</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {leaveRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No upcoming leaves</p>
          ) : (
            leaveRequests.map((leave) => (
              <div key={leave.id} className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <p className="font-medium">{leave.type}</p>
                  <p className="text-sm text-muted-foreground">
                    {leave.startDate} - {leave.endDate}
                  </p>
                  <p className="text-sm">{leave.days} days</p>
                </div>
                <Badge className={cn("text-white", getStatusColor(leave.status))}>
                  {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                </Badge>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
