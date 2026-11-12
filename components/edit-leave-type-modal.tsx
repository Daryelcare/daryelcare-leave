
"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import type { LeaveType } from "@/lib/types"

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  description: z.string().min(2, { message: "Description must be at least 2 characters" }),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, { message: "Invalid color format" }),
  defaultDays: z.coerce.number<number>().min(0),
  isPaid: z.boolean(),
  requiresApproval: z.boolean(),
  allowNegativeBalance: z.boolean(),
  isActive: z.boolean(),
})

// What the form fields hold, and what validation turns them into
type FormInput = z.input<typeof formSchema>
type FormValues = z.output<typeof formSchema>

interface EditLeaveTypeModalProps {
  leaveType: LeaveType | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function EditLeaveTypeModal({ leaveType, isOpen, onClose, onSuccess }: EditLeaveTypeModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: leaveType?.name || "",
      description: leaveType?.description || "",
      color: leaveType?.color || "#6366f1",
      defaultDays: leaveType?.defaultDays || 0,
      isPaid: leaveType?.isPaid || false,
      requiresApproval: leaveType?.requiresApproval || true,
      allowNegativeBalance: leaveType?.allowNegativeBalance || false,
      isActive: leaveType?.isActive || true,
    },
  })

  // Reset form when leave type changes
  useEffect(() => {
    if (isOpen) {
      form.reset({
        name: leaveType?.name || "",
        description: leaveType?.description || "",
        color: leaveType?.color || "#6366f1",
        defaultDays: leaveType?.defaultDays || 0,
        isPaid: leaveType?.isPaid || false,
        requiresApproval: leaveType?.requiresApproval || true,
        allowNegativeBalance: leaveType?.allowNegativeBalance || false,
        isActive: leaveType?.isActive || true,
      })
    }
  }, [form, isOpen, leaveType])

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true)
    try {
      console.log("Submitting leave type data:", data) // For debugging
      
      await fetchWithAuth(`/api/leave-types${leaveType ? `/${leaveType.id}` : ""}`, {
        method: leaveType ? "PUT" : "POST",
        body: JSON.stringify(data),
      })

      toast({
        title: "Success",
        description: `Leave type ${leaveType ? "updated" : "created"} successfully`,
      })

      onSuccess()
      onClose()
    } catch (error) {
      console.error("Error submitting leave type:", error)
      toast({
        title: "Error",
        description: `Failed to ${leaveType ? "update" : "create"} leave type: ${handleApiError(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{leaveType ? "Edit" : "Add"} leave type</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter leave type name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Colour</FormLabel>
                  <div className="flex items-center gap-3">
                    <FormControl>
                      <Input
                        {...field}
                        type="color"
                        className="h-10 w-14 cursor-pointer p-1 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0"
                      />
                    </FormControl>
                    <span className="font-mono text-sm uppercase text-muted-foreground">{field.value}</span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="defaultDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default days</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" min="0" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isPaid"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Paid leave</FormLabel>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requiresApproval"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Requires approval</FormLabel>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="allowNegativeBalance"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Allow negative balance</FormLabel>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Active</FormLabel>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : leaveType ? "Save changes" : "Add leave type"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
