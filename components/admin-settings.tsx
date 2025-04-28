"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ResetLeaveBalancesModal } from "./reset-leave-balances-modal"
import { useApp } from "./app-provider"
import { AlertTriangle } from "lucide-react"

export function AdminSettings() {
  const { user } = useApp()
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)

  // Only render for admin users
  if (user?.role !== "admin") {
    return null
  }

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-4">Admin Settings</h2>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Leave Management
          </CardTitle>
          <CardDescription>Advanced settings for managing employee leave balances</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-2">Reset All Leave Balances</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Reset the leave balances for all employees in the system. This will set all employees' remaining days to
                the specified value and reset their taken days to zero.
              </p>
              <Button variant="destructive" onClick={() => setIsResetModalOpen(true)}>
                Reset All Leave Balances
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ResetLeaveBalancesModal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} />
    </div>
  )
}
