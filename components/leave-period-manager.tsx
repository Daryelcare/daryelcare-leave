"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon, Plus } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { useToast } from "@/components/ui/use-toast"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

// Form schema
const formSchema = z.object({
  startDate: z.date({ required_error: "Start date is required" }),
  endDate: z
    .date({ required_error: "End date is required" })
    .refine((date) => date instanceof Date && !isNaN(date.getTime()), {
      message: "End date is required",
    })
    .refine(
      (date, ctx) => {
        return date > ctx.startDate
      },
      {
        message: "End date must be after start date",
      },
    ),
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
  } = useQuery({
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

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Leave Periods</CardTitle>
              <CardDescription>Manage annual leave periods</CardDescription>
            </div>
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="gap-2 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
            >
              <Plus className="h-4 w-4" />
              New Period
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between p-4 border rounded-md">
                  <div className="w-1/3 h-6 bg-gray-200 rounded animate-pulse"></div>
                  <div className="w-1/4 h-6 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="p-4 text-destructive border border-destructive/50 rounded-md">
              Error loading leave periods: {handleApiError(error)}
            </div>
          ) : periods.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground border rounded-md">
              No leave periods found. Create your first period to start allocating leave.
            </div>
          ) : (
            <div className="space-y-2">
              {periods.map((period) => (
                <div
                  key={period.id}
                  className={cn(
                    "flex justify-between p-4 border rounded-md",
                    period.isActive && "border-purple-500 bg-purple-50 dark:bg-purple-950/20",
                  )}
                >
                  <div>
                    <p className="font-medium">
                      {format(new Date(period.startDate), "dd MMM yyyy")} -{" "}
                      {format(new Date(period.endDate), "dd MMM yyyy")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Created on {format(new Date(period.createdAt), "dd MMM yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center">
                    {period.isActive && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                        Active
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          When a new period is created, all employees will automatically have their leave balances reset to 28 days.
        </CardFooter>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Leave Period</DialogTitle>
            <DialogDescription>
              Create a new annual leave period. This will automatically reset all active employees to 28 days of leave.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>End Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date <= form.getValues("startDate")}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
                >
                  {isSubmitting ? "Creating..." : "Create Period"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
