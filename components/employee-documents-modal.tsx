"use client"

import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useQuery } from "@tanstack/react-query"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowRight, FileText, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatDisplayDate } from "@/lib/dates"
import { EmptyState, ErrorState } from "./page-kit"
import type { EmployeeDocument } from "@/lib/types"

interface EmployeeDocumentsModalProps {
  employeeId: string
  employeeName: string
  isOpen: boolean
  onClose: () => void
}

export function EmployeeDocumentsModal({ employeeId, employeeName, isOpen, onClose }: EmployeeDocumentsModalProps) {
  const {
    data: documents = [],
    isLoading,
    isError,
    error,
  } = useQuery<EmployeeDocument[]>({
    queryKey: ["employeeDocuments", employeeId],
    queryFn: async () => {
      return fetchWithAuth(`/api/documents?employeeId=${employeeId}`)
    },
    enabled: isOpen && !!employeeId,
  })

  const badgeFor = (daysLeft: number | null) => {
    if (daysLeft === null) return null
    const variant = daysLeft <= 7 ? "destructive" : daysLeft <= 30 ? "warning" : daysLeft <= 90 ? "default" : "success"
    const label =
      daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Expires today" : `${daysLeft}d left`
    return (
      <Badge variant={variant} dot={daysLeft <= 90} className="px-2 text-[11px] leading-[18px] tabular">
        {label}
      </Badge>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Documents</DialogTitle>
          <DialogDescription>{employeeName}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState title="Couldn't load documents" message={handleApiError(error)} />
        ) : documents.length > 0 ? (
          <div className="space-y-5">
            {documents.map((doc) => {
              // Right to work leads; the other documents follow, quieter
              const items = [
                { label: "Passport", date: doc.passportExpiry, days: doc.passportDaysLeft },
                { label: "BRP", date: doc.brpExpiry, days: doc.brpDaysLeft },
                {
                  label: doc.otherDocumentType || "Other",
                  date: doc.otherDocumentExpiry,
                  days: doc.otherDocumentDaysLeft,
                },
              ].filter((item) => item.date)
              return (
                <div key={doc.id} className="space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <Badge variant="secondary">{doc.status}</Badge>
                    {doc.country && <Badge variant="outline">{doc.country}</Badge>}
                    {doc.isSponsored && <Badge variant="default">Sponsored</Badge>}
                    {doc.is20Hours && <Badge variant="secondary">20 hrs</Badge>}
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary-soft/60 px-4 py-3.5">
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Right to work
                      </p>
                      <p className="font-display text-base font-semibold tabular">
                        {doc.rightToWorkExpiry ? formatDisplayDate(doc.rightToWorkExpiry) : "No expiry recorded"}
                      </p>
                    </div>
                    {doc.rightToWorkExpiry && badgeFor(doc.rightToWorkDaysLeft)}
                  </div>
                  {items.length > 0 && <p className="eyebrow pt-1">Other documents</p>}
                  {items.length > 0 && (
                    <dl className="grid gap-2.5 sm:grid-cols-2">
                      {items.map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border/80 px-4 py-3"
                        >
                          <div>
                            <dt className="text-xs font-semibold text-muted-foreground">{item.label}</dt>
                            <dd className="text-sm font-semibold tabular">{formatDisplayDate(item.date as string)}</dd>
                          </div>
                          {badgeFor(item.days)}
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title="No documents recorded"
            description="Add this employee's right to work date, and any passport or BRP dates, from the Documents page."
            compact
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button asChild>
            <Link href="/dashboard/document-tracker">
              Open Documents
              <ArrowRight />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
