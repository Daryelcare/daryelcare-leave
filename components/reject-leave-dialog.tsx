"use client"

// Asks for the reason when rejecting one or more leave entries (a reason is
// always required, as in CarerHR).

import { useEffect, useState } from "react"
import { Loader2, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function RejectLeaveDialog({
  count,
  who,
  open,
  onOpenChange,
  onConfirm,
}: {
  /** How many entries are being rejected */
  count: number
  /** The employee's name when it's one entry */
  who?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => Promise<boolean>
}) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) {
      setReason("")
      setError(false)
    }
  }, [open])

  const submit = async () => {
    if (!reason.trim()) return setError(true)
    setBusy(true)
    const ok = await onConfirm(reason.trim())
    setBusy(false)
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{count === 1 ? "Reject leave" : `Reject ${count} entries`}</DialogTitle>
          <DialogDescription>
            {count === 1 && who
              ? `Say why ${who}'s leave is being rejected. It's kept with the entry.`
              : "Say why these entries are being rejected. The same reason is kept with each one."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reject-reason">Reason</Label>
          <Textarea
            id="reject-reason"
            autoFocus
            rows={3}
            value={reason}
            aria-invalid={error}
            onChange={(e) => {
              setReason(e.target.value)
              if (e.target.value.trim()) setError(false)
            }}
            placeholder="For example: not enough cover in the branch that week"
          />
          {error && <p className="text-xs font-medium text-destructive">A reason is needed to reject leave.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <X />}
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
