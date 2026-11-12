"use client"

import { useState } from "react"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ResetLeaveBalancesModal } from "./reset-leave-balances-modal"
import { useApp } from "./app-provider"

// Organisation-wide maintenance actions (admins only)
export function AdminSettings() {
  const { user } = useApp()
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)

  if (user?.role !== "admin") {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="surface overflow-hidden border-destructive/20">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="space-y-1">
            <h2 className="text-[17px] font-semibold">Reset all leave balances</h2>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              Sets every active employee&apos;s remaining days to a value you choose and their taken days to zero. Use this at
              the start of a new leave year.
            </p>
          </div>
          <Button variant="destructive" onClick={() => setIsResetModalOpen(true)} className="shrink-0">
            <RotateCcw />
            Reset balances
          </Button>
        </div>
      </div>
      <ResetLeaveBalancesModal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} />
    </div>
  )
}
