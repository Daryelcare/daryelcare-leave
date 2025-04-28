"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { useApp } from "./app-provider"
import { format, parseISO } from "date-fns"

export function LeaveAllocationCard() {
  const { user } = useApp()

  const {
    data: allocations = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["leaveAllocations", user?.id],
    queryFn: async () => {
      if (!user) return []
      // In a real app, you would fetch the employee ID based on the user ID
      // For now, we'll just fetch all allocations for active periods
      return fetchWithAuth(`/api/leave-allocations?activeOnly=true`)
    },
    enabled: !!user,
  })

  // Find the active allocation
  const activeAllocation = allocations.length > 0 ? allocations[0] : null

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-2 w-full mb-4" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card className="border-destructive/50">
        <CardHeader className="pb-2">
          <CardTitle>Annual Leave</CardTitle>
          <CardDescription className="text-destructive">Error loading allocation</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{handleApiError(error)}</p>
        </CardContent>
      </Card>
    )
  }

  if (!activeAllocation) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Annual Leave</CardTitle>
          <CardDescription>No active leave period found</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Contact HR to set up your leave allocation.</p>
        </CardContent>
      </Card>
    )
  }

  const percentUsed = Math.round((activeAllocation.usedDays / activeAllocation.allocationDays) * 100)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Annual Leave</CardTitle>
        <CardDescription>
          Period: {format(parseISO(activeAllocation.periodStart), "dd MMM yyyy")} -{" "}
          {format(parseISO(activeAllocation.periodEnd), "dd MMM yyyy")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            {activeAllocation.usedDays} used of {activeAllocation.allocationDays} days
          </span>
          <span className="text-sm font-medium">{percentUsed}%</span>
        </div>
        <Progress
          value={percentUsed}
          className="h-2"
          indicatorClassName={percentUsed > 90 ? "bg-red-600" : percentUsed > 75 ? "bg-orange-500" : "bg-purple-600"}
        />
        <div className="mt-4 text-sm">
          <span className="font-medium">{activeAllocation.remainingDays} days</span> remaining
        </div>
      </CardContent>
    </Card>
  )
}
