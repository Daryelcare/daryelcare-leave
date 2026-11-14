"use client"

// Who is over entitlement: current staff whose balance is below zero, most
// overdrawn first (as in CarerHR), each linking to their employee record.

import Link from "next/link"
import { AlertTriangle, ArrowRight, PartyPopper } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, plural } from "./page-kit"

export type OverPerson = { id: string; name: string; branch: string; daysRemaining: number; daysTaken: number }

export function OverEntitlementDialog({
  people,
  open,
  onOpenChange,
}: {
  people: OverPerson[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-[520px]">
        <DialogHeader className="px-5 pb-4 pt-5 text-left sm:px-6 sm:pt-6">
          <div className="flex items-center gap-3 pr-8">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive-soft text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-lg">Over entitlement</DialogTitle>
              <DialogDescription className="mt-0.5">
                {people.length
                  ? `${plural(people.length, "person", "people")} below zero, most overdrawn first`
                  : "Current staff below zero"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto px-3 pb-5 sm:px-4">
          {people.length === 0 ? (
            <div className="mx-2 flex flex-col items-center rounded-2xl bg-success-soft px-6 py-10 text-center">
              <PartyPopper className="h-6 w-6 text-success" />
              <p className="mt-3 font-display font-semibold text-success">Nobody is over</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Every current employee has days left.</p>
            </div>
          ) : (
            <ul className="space-y-1.5 px-1">
              {people.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/dashboard/employees?employee=${encodeURIComponent(p.id)}`}
                    onClick={() => onOpenChange(false)}
                    className="group flex items-center gap-3 rounded-2xl bg-muted/50 px-3 py-2.5 transition-colors hover:bg-muted"
                  >
                    <Avatar name={p.name} className="h-9 w-9 text-xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.branch} · {plural(p.daysTaken, "day")} taken
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-destructive-soft px-2.5 py-1 text-xs font-semibold tabular text-destructive">
                      {p.daysRemaining} days
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
