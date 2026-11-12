"use client"

import { useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from "@/components/ui/select"
import { settingsHref, visibleSettingsSections } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import { UserManagementTable } from "./user-management-table"
import { BranchManagementTable } from "./branch-management-table"
import { LeavePeriodManager } from "./leave-period-manager"
import { AdminSettings } from "./admin-settings"
import { Avatar, Field, PageHeader, SectionHeader } from "./page-kit"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { handleApiError } from "@/lib/api-utils"
import { useApp } from "./app-provider"
import { changeOwnPassword } from "@/lib/auth"
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

  // Which section is open lives in the address (?section=), so links and back work
  const router = useRouter()
  const searchParams = useSearchParams()
  const sections = visibleSettingsSections(isAdmin)
  const requested = searchParams.get("section")
  const current = sections.find((s) => s.id === requested) || sections[0]
  const openSection = (id: string) => router.replace(settingsHref(id), { scroll: false })
  const groups = (["Personal", "Organisation"] as const)
    .map((group) => ({ group, items: sections.filter((s) => s.group === group) }))
    .filter((g) => g.items.length > 0)

  const content = () => {
    switch (current.id) {
      case "account":
        return (
          <div className="space-y-4">
            <SectionHeader title={current.title} description={current.description} />
            <div className="surface overflow-hidden">
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
          </div>
        )
      case "password":
        return (
          <div className="space-y-4">
            <SectionHeader
              title={current.title}
              description="Use at least 8 characters. You'll stay signed in on this device."
            />
            <div className="surface max-w-xl overflow-hidden">
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
          </div>
        )
      case "users":
        return <UserManagementTable />
      case "branches":
        return <BranchManagementTable />
      case "leave-types":
        return <LeaveTypeManagementTable />
      case "leave-periods":
        return <LeavePeriodManager />
      case "advanced":
        return (
          <div className="space-y-4">
            <SectionHeader title={current.title} description={current.description} />
            <AdminSettings />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Settings"
        description={isAdmin ? "Your account, and how your organisation is set up." : "Your account and password."}
      />

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        {/* Large screens: grouped section menu */}
        <nav aria-label="Settings sections" className="hidden lg:block">
          <div className="sticky top-20 space-y-5">
            {groups.map(({ group, items }) => (
              <div key={group} className="space-y-1">
                <p className="eyebrow px-3 pb-1">{group}</p>
                {items.map((section) => {
                  const active = section.id === current.id
                  return (
                    <button
                      key={section.id}
                      onClick={() => openSection(section.id)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
                        active
                          ? "bg-primary-soft font-semibold text-primary"
                          : "text-foreground/80 hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <section.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                      {section.title}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </nav>

        {/* Phones and tablets: a section picker */}
        <div className="lg:hidden">
          <Select value={current.id} onValueChange={openSection}>
            <SelectTrigger aria-label="Settings section" className="h-11">
              <div className="flex min-w-0 items-center gap-2.5">
                <current.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-semibold">{current.title}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {groups.map(({ group, items }) => (
                <SelectGroup key={group}>
                  <SelectLabel>{group}</SelectLabel>
                  {items.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div key={current.id} className="page-enter min-w-0 max-w-4xl">
          {content()}
        </div>
      </div>
    </div>
  )
}
