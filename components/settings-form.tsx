"use client"

import { useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { useApp } from "./app-provider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BranchManagementTable } from "./branch-management-table"
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
      await fetchWithAuth("/api/users/change-password", {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      })

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

  return (
    <Tabs defaultValue="account" className="w-full">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
        {isAdmin && (
          <>
            <TabsTrigger value="branches">Branch Management</TabsTrigger>
            <TabsTrigger value="leave-types">Leave Types</TabsTrigger>
          </>
        )}
      </TabsList>

      <TabsContent value="account">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>View your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Name</h3>
              <p>{user?.name || "Not available"}</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Email</h3>
              <p>{user?.email || "Not available"}</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Role</h3>
              <p className="capitalize">{user?.role || "Not available"}</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Branches</h3>
              <div className="flex flex-wrap gap-2">
                {user?.branches && user.branches.length > 0 ? (
                  user.branches.map((branch, index) => (
                    <span key={index} className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                      {branch}
                    </span>
                  ))
                ) : (
                  <p>No branches assigned</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="password">
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your password</CardDescription>
          </CardHeader>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
              <CardContent className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter your current password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter your new password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Confirm your new password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
                >
                  {isSubmitting ? "Updating..." : "Update Password"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </TabsContent>

      {isAdmin && (
        <>
          <TabsContent value="branches">
            <Card>
              <CardHeader>
                <CardTitle>Branch Management</CardTitle>
                <CardDescription>Add, edit, and manage company branches</CardDescription>
              </CardHeader>
              <CardContent>
                <BranchManagementTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leave-types">
            <Card>
              <CardHeader>
                <CardTitle>Leave Types Management</CardTitle>
                <CardDescription>Add, edit, and manage leave types</CardDescription>
              </CardHeader>
              <CardContent>
                <LeaveTypeManagementTable />
              </CardContent>
            </Card>
          </TabsContent>
        </>
      )}
    </Tabs>
  )
}
