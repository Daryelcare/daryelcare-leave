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
          <DialogTitle>Edit Branch Assignments</DialogTitle>
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
                    <FormLabel className="text-base">Assigned Branches</FormLabel>
                  </div>
                  <div className="space-y-2">
                    {branches.map((branch) => (
                      <div key={branch.id} className="flex items-center space-x-2">
                        <FormField
                          control={form.control}
                          name="branches"
                          render={({ field }) => {
                            return (
                              <FormItem key={branch.id} className="flex flex-row items-start space-x-3 space-y-0">
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
                                <FormLabel className="font-normal">{branch.name}</FormLabel>
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
                className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
