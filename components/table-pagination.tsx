"use client"

// Page controls for long lists: rows per page (50, 100, 250 or all) and
// previous / next, as on CarerHR's lists.

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PAGE_SIZES, type PageSize } from "@/lib/leave-list"

export function TablePagination({
  page,
  pages,
  from,
  to,
  total,
  pageSize,
  label,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  pages: number
  from: number
  to: number
  total: number
  pageSize: PageSize
  /** "entries" */
  label: string
  onPageChange: (page: number) => void
  onPageSizeChange: (size: PageSize) => void
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-border/70 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="tabular">
        {total === 0 ? `No ${label}` : `${from}–${to} of ${total} ${label}`}
      </p>
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline">Rows per page</span>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v) as PageSize)}>
          <SelectTrigger className="h-9 w-[84px]" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s === 0 ? "All" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        <span className="min-w-[64px] text-center tabular">
          {page} / {pages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
