"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { useBranches } from "@/hooks/use-branches"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import type { User } from "@/lib/types"

// Form schema
const formSchema = z.object({
  branches: z.array(z.string()).min(1, { message: "Please select at least one branch." }),
})

type FormValues = z.infer<typeof formSchema>

interface EditBranchesModalProps {
  user: User
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditBranchesModal({ user, open, onOpenChange }: EditBranchesModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: branches = [], isLoading: isLoadingBranches } = useBranches()

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      branches: user.branches || [],
    },
  })

  // Update form values when user changes
  useEffect(() => {
    if (user && open) {
      form.reset({
        branches: user.branches || [],
      })
    }
  }, [user, form, open])

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true)
    try {
      await fetchWithAuth(`/api/users/${user.id}/branches`, {
        method: "PUT",
        body: JSON.stringify({
          branches: data.branches,
        }),
      })

      toast({
        title: "Success",
        description: "Branch assignments updated successfully",
      })

      // Close modal
      onOpenChange(false)

      // Refresh user list
      queryClient.invalidateQueries({ queryKey: ["users"] })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to update branch assignments: ${handleApiError(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit branches</DialogTitle>
          <DialogDescription>Update branch assignments for {user.name}.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="branches"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel>Assigned branches</FormLabel>
                  </div>
                  {isLoadingBranches && (
                      <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                          <Skeleton key={i} className="h-11 w-full rounded-lg" />
                        ))}
                      </div>
                    )}
                    {!isLoadingBranches && branches.length === 0 && (
                      <p className="text-sm text-muted-foreground">No branches yet. Add them on the Branches page.</p>
                    )}
                  <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80">
                    {branches.map((branch) => (
                      <div key={branch.id} className="flex items-center px-3.5 py-2.5 transition-colors hover:bg-muted/40">
                        <FormField
                          control={form.control}
                          name="branches"
                          render={({ field }) => {
                            return (
                              <FormItem key={branch.id} className="flex w-full flex-row items-center gap-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(branch.name)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, branch.name])
                                        : field.onChange(field.value?.filter((value) => value !== branch.name))
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="flex-1 cursor-pointer py-0.5 font-medium">{branch.name}</FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
