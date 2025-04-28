"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface ResetLeaveBalancesModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ResetLeaveBalancesModal({ isOpen, onClose }: ResetLeaveBalancesModalProps) {
  const [days, setDays] = useState<number>(28)
  const [confirmText, setConfirmText] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleReset = async () => {
    if (confirmText !== "RESET") {
      setError("Please type RESET to confirm this action")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/leave-allocations/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ days }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.details || "Failed to reset leave balances")
      }

      toast({
        title: "Success",
        description: `All employee leave balances have been reset to ${days} days remaining and 0 days taken.`,
      })

      // Reset form and close modal
      setDays(28)
      setConfirmText("")
      onClose()
    } catch (error) {
      console.error("Error resetting leave balances:", error)
      setError(
        error instanceof Error ? error.message : "An unexpected error occurred. Please try again or contact support.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Reset All Leave Balances</DialogTitle>
          <DialogDescription>This will reset the leave balances for ALL employees in the system.</DialogDescription>
        </DialogHeader>

        <Alert variant="destructive" className="my-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Warning: This action cannot be undone</AlertTitle>
          <AlertDescription>
            This will set all employees' remaining days to the specified value and reset their taken days to zero. This
            action is irreversible and will affect all employees in the system.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="days" className="text-right">
              Days
            </Label>
            <Input
              id="days"
              type="number"
              min={0}
              value={days}
              onChange={(e) => setDays(Number.parseInt(e.target.value) || 0)}
              className="col-span-3"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="confirm" className="text-right">
              Confirm
            </Label>
            <div className="col-span-3 space-y-2">
              <Input
                id="confirm"
                placeholder='Type "RESET" to confirm'
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Type <span className="font-bold">RESET</span> to confirm this action
              </p>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReset}
            disabled={isLoading || confirmText !== "RESET"}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Resetting...
              </>
            ) : (
              "Reset All Leave Balances"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
