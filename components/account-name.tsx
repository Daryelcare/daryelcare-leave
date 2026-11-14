"use client"

// Settings → Account: change your own display name.

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { useApp } from "./app-provider"

export function AccountName() {
  const { user, setUser } = useApp()
  const { toast } = useToast()
  const [name, setName] = useState(user?.name ?? "")
  const [saving, setSaving] = useState(false)
  const changed = name.trim() !== (user?.name ?? "") && name.trim().length >= 2

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetchWithAuth("/api/users/me", { method: "PUT", body: JSON.stringify({ name }) })
      if (user) setUser({ ...user, name: res.name })
      setName(res.name)
      toast({ title: "Name saved" })
    } catch (err) {
      console.error("Couldn't save name:", err)
      toast({ title: "Couldn't save your name", description: handleApiError(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="space-y-1.5"
      onSubmit={(e) => {
        e.preventDefault()
        if (changed) save()
      }}
    >
      <Label htmlFor="account-name">Name</Label>
      <div className="flex gap-2">
        <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <Button type="submit" variant="outline" disabled={!changed || saving}>
          {saving && <Loader2 className="animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  )
}
