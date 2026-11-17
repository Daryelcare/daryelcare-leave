"use client"

import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * The template download used by every import: CSV by default, with the Excel
 * version as a quieter second choice.
 */
export function TemplateDownload({
  onDownload,
  busy,
}: {
  onDownload: (format: "csv" | "excel") => void
  busy?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button variant="outline" size="sm" className="gap-2" onClick={() => onDownload("csv")} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Download className="h-4 w-4" />}
        Download template
      </Button>
      <button
        type="button"
        onClick={() => onDownload("excel")}
        disabled={busy}
        className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
      >
        or as Excel
      </button>
    </div>
  )
}
