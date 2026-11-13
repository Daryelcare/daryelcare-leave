"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState, ErrorState, ListSkeleton, SectionHeader } from "./page-kit"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { DatePicker } from "@/components/ui/date-picker"
import { CalendarCheck2, Plus } from "lucide-react"
import { addDays, format } from "date-fns"
import { cn } from "@/lib/utils"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { useToast } from "@/components/ui/use-toast"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

// Form schema
const formSchema = z
  .object({
    startDate: z.date({ error: "Start date is required" }),
    endDate: z.date({ error: "End date is required" }),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  })

type FormValues = z.infer<typeof formSchema>

export function LeavePeriodManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch leave periods
  const {
    data: periods = [],
    isLoading,
    isError,
    error,
  } = useQuery<{ id: string; startDate: string; endDate: string; isActive: boolean; createdAt: string }[]>({
    queryKey: ["leavePeriods"],
    queryFn: async () => {
      return fetchWithAuth("/api/leave-periods")
    },
  })

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      startDate: undefined,
      endDate: undefined,
    },
  })

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true)
    try {
      await fetchWithAuth("/api/leave-periods", {
        method: "POST",
        body: JSON.stringify({
          startDate: format(data.startDate, "yyyy-MM-dd"),
          endDate: format(data.endDate, "yyyy-MM-dd"),
        }),
      })

      toast({
        title: "Success",
        description: "New leave period created successfully. All employee leave balances have been reset.",
      })

      // Reset form
      form.reset()

      // Close dialog
      setIsDialogOpen(false)

      // Refresh periods list
      queryClient.invalidateQueries({ queryKey: ["leavePeriods"] })

      // Also refresh employees as their leave balances have been reset
      queryClient.invalidateQueries({ queryKey: ["employees"] })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to create leave period: ${handleApiError(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (value: string) => format(new Date(value), "d MMM yyyy")

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Leave periods"
        description="Each leave year runs between two dates. Starting a new one resets active employees to 28 days."
        actions={
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus />
            New period
          </Button>
        }
      />

      <div className="surface overflow-hidden">
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : isError ? (
          <ErrorState title="Couldn't load leave periods" message={handleApiError(error)} className="m-5" />
        ) : periods.length === 0 ? (
          <EmptyState icon={CalendarCheck2} title="No leave periods yet" description="Create your first period to start the leave year." />
        ) : (
          <ul className="divide-y divide-border/70">
            {periods.map((period) => (
              <li key={period.id} className={cn("flex items-center gap-4 px-5 py-4 sm:px-6", period.isActive && "bg-primary-soft/40")}>
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    period.isActive ? "bg-primary text-primary-foreground shadow-raised" : "bg-secondary text-muted-foreground",
                  )}
                >
                  <CalendarCheck2 className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tabular">
                    {formatDate(period.startDate)} – {formatDate(period.endDate)}
                  </p>
                  <p className="text-xs text-muted-foreground">Created {formatDate(period.createdAt)}</p>
                </div>
                {period.isActive ? (
                  <Badge variant="default" dot>
                    Current
                  </Badge>
                ) : (
                  <Badge variant="secondary">Ended</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Start a new leave period</DialogTitle>
            <DialogDescription>
              This ends the current period and resets every active employee to 28 days remaining and 0 taken.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start date</FormLabel>
                      <FormControl>
                        <DatePicker value={field.value} onChange={field.onChange} placeholder="Start date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End date</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="End date"
                          min={form.watch("startDate") ? addDays(form.watch("startDate"), 1) : undefined}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating…" : "Create period"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
