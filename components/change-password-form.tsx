"use client"

import { useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { KeyRound, Loader2 } from "lucide-react"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { handleApiError } from "@/lib/api-utils"
import { useApp } from "./app-provider"
import { changeOwnPassword } from "@/lib/auth"

// Form schema
const formSchema = z
  .object({
    currentPassword: z.string().min(1, { message: "Current password is required." }),
    newPassword: z.string().min(6, { message: "New password must be at least 6 characters." }),
    confirmPassword: z.string().min(6, { message: "Confirm password must be at least 6 characters." }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type FormValues = z.infer<typeof formSchema>

export function ChangePasswordForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const { user } = useApp()

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to change your password",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      await changeOwnPassword(data.currentPassword, data.newPassword)

      toast({
        title: "Success",
        description: "Password changed successfully",
      })

      // Reset form
      form.reset()
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to change password: ${handleApiError(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const fields: { name: "currentPassword" | "newPassword" | "confirmPassword"; label: string; auto: string }[] = [
    { name: "currentPassword", label: "Current password", auto: "current-password" },
    { name: "newPassword", label: "New password", auto: "new-password" },
    { name: "confirmPassword", label: "Confirm new password", auto: "new-password" },
  ]

  return (
    <div className="surface max-w-xl overflow-hidden">
      <div className="flex items-center gap-3 p-5 pb-0 sm:p-6 sm:pb-0">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <KeyRound className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="text-[17px] font-semibold">Your password</h2>
          <p className="text-sm text-muted-foreground">Use at least 6 characters.</p>
        </div>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-4 p-5 sm:p-6">
            {fields.map((item) => (
              <FormField
                key={item.name}
                control={form.control}
                name={item.name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{item.label}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete={item.auto} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
          <div className="flex justify-end border-t border-border/70 bg-muted/40 px-5 py-3 sm:px-6">
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isSubmitting ? "Changing password…" : "Change password"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
