"use client"

import { useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { KeyRound, Loader2, Palette, SlidersHorizontal, UserRound } from "lucide-react"
import { AdminSettings } from "./admin-settings"
import { Avatar, Field, PageHeader } from "./page-kit"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { handleApiError } from "@/lib/api-utils"
import { useApp } from "./app-provider"
import { changeOwnPassword } from "@/lib/auth"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LeaveTypeManagementTable } from "./leave-type-management-table"

// Password change form schema
const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, { message: "Current password is required" }),
    newPassword: z.string().min(8, { message: "Password must be at least 8 characters" }),
    confirmPassword: z.string().min(8, { message: "Confirm password is required" }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type PasswordFormValues = z.infer<typeof passwordFormSchema>

export function SettingsForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const { user } = useApp()

  // Initialize password form
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  // Get user role from context
  const isAdmin = user?.role === "admin"

  // Handle password form submission
  const onPasswordSubmit = async (data: PasswordFormValues) => {
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
        description: "Your password has been updated",
      })

      // Reset form
      passwordForm.reset()
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

  const passwordFields: { name: "currentPassword" | "newPassword" | "confirmPassword"; label: string; auto: string }[] = [
    { name: "currentPassword", label: "Current password", auto: "current-password" },
    { name: "newPassword", label: "New password", auto: "new-password" },
    { name: "confirmPassword", label: "Confirm new password", auto: "new-password" },
  ]

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader title="Settings" description="Your account, password and organisation preferences." />

      <Tabs defaultValue="account" className="w-full">
        <TabsList className={isAdmin ? "grid h-auto w-full grid-cols-2 gap-1 sm:inline-flex sm:h-10 sm:w-auto" : undefined}>
          <TabsTrigger value="account">
            <UserRound />
            Account
          </TabsTrigger>
          <TabsTrigger value="password">
            <KeyRound />
            Password
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="leave-types">
                <Palette />
                Leave types
              </TabsTrigger>
              <TabsTrigger value="advanced">
                <SlidersHorizontal />
                Advanced
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="account">
          <div className="surface max-w-3xl overflow-hidden">
            <div className="flex items-center gap-4 p-5 sm:p-6">
              <Avatar name={user?.name} className="h-14 w-14 text-lg" />
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold tracking-[-0.02em]">{user?.name || "Your account"}</p>
                <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <dl className="grid gap-5 border-t border-border/70 p-5 sm:grid-cols-2 sm:p-6">
              <Field label="Name">{user?.name || "—"}</Field>
              <Field label="Email">{user?.email || "—"}</Field>
              <Field label="Role">{isAdmin ? "Administrator" : "Branch manager"}</Field>
              <Field label="Branches">
                <span className="flex flex-wrap gap-1.5">
                  {isAdmin ? (
                    "All branches"
                  ) : user?.branches && user.branches.length > 0 ? (
                    user.branches.map((branch) => (
                      <Badge key={branch} variant="outline">
                        {branch}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">No branches assigned</span>
                  )}
                </span>
              </Field>
            </dl>
            <p className="border-t border-border/70 bg-muted/40 px-5 py-3 text-xs text-muted-foreground sm:px-6">
              To change your name, role or branches, ask an administrator.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="password">
          <div className="surface max-w-xl overflow-hidden">
            <div className="p-5 pb-0 sm:p-6 sm:pb-0">
              <h2 className="text-[17px] font-semibold">Change password</h2>
              <p className="text-sm text-muted-foreground">Use at least 8 characters. You&apos;ll stay signed in on this device.</p>
            </div>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
                <div className="space-y-4 p-5 sm:p-6">
                  {passwordFields.map((item) => (
                    <FormField
                      key={item.name}
                      control={passwordForm.control}
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
                    {isSubmitting ? "Updating…" : "Update password"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </TabsContent>

        {isAdmin && (
          <>
            <TabsContent value="leave-types">
              <LeaveTypeManagementTable />
            </TabsContent>

            <TabsContent value="advanced">
              <AdminSettings />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}
