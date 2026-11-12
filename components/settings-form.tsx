"use client"

import { useEffect, useRef, useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
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

  const passwordFields: { name: "currentPassword" | "newPassword" | "confirmPassword"; label: string; auto: string }[] =
    [
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
  // Keep the open tab visible when the row scrolls sideways on small screens
  const activeTabRef = useRef<HTMLButtonElement>(null)
  const tabRowRef = useRef<HTMLDivElement>(null)
  const [fade, setFade] = useState({ left: false, right: false })
  const updateFade = () => {
    const row = tabRowRef.current
    if (!row) return
    setFade({ left: row.scrollLeft > 2, right: row.scrollLeft + row.clientWidth < row.scrollWidth - 2 })
  }
  useEffect(() => {
    const row = tabRowRef.current
    const tab = activeTabRef.current
    if (row && tab) {
      // Only scroll when the open tab is cut off, leaving room to see its neighbour
      const margin = 40
      const left = tab.offsetLeft // the row is the offset parent, so this ignores its scroll
      if (left < row.scrollLeft) row.scrollLeft = Math.max(0, left - margin)
      else if (left + tab.offsetWidth > row.scrollLeft + row.clientWidth)
        row.scrollLeft = left + tab.offsetWidth - row.clientWidth + margin
    }
    updateFade()
  }, [current.id])
  useEffect(() => {
    window.addEventListener("resize", updateFade)
    return () => window.removeEventListener("resize", updateFade)
  }, [])
  // Arrow keys, Home and End move between tabs
  const onTabKey = (e: React.KeyboardEvent) => {
    const i = sections.findIndex((s) => s.id === current.id)
    const next =
      e.key === "ArrowRight"
        ? i + 1
        : e.key === "ArrowLeft"
          ? i - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? sections.length - 1
              : null
    if (next === null) return
    e.preventDefault()
    const target = sections[(next + sections.length) % sections.length]
    openSection(target.id)
    requestAnimationFrame(() => document.getElementById(`settings-tab-${target.id}`)?.focus())
  }
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
                  <p className="truncate font-display text-lg font-semibold tracking-[-0.02em]">
                    {user?.name || "Your account"}
                  </p>
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

      <div className="space-y-6 sm:space-y-8">
        {/* Section tabs, grouped Personal / Organisation. Scrolls sideways on small screens. */}
        <div className="relative -mx-4 border-b border-border sm:mx-0">
          <div
            ref={tabRowRef}
            onScroll={updateFade}
            role="tablist"
            aria-label="Settings sections"
            onKeyDown={onTabKey}
            className="relative flex gap-6 overflow-x-auto px-4 [scrollbar-width:none] sm:gap-8 sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {groups.map(({ group, items }, gi) => (
              <div
                key={group}
                className={cn("flex shrink-0 flex-col", gi > 0 && "border-l border-border pl-6 sm:pl-8")}
              >
                <p className="eyebrow pb-1.5">{group}</p>
                <div className="flex gap-1">
                  {items.map((section) => {
                    const active = section.id === current.id
                    return (
                      <button
                        key={section.id}
                        id={`settings-tab-${section.id}`}
                        role="tab"
                        type="button"
                        aria-selected={active}
                        aria-controls="settings-panel"
                        tabIndex={active ? 0 : -1}
                        onClick={() => openSection(section.id)}
                        ref={active ? activeTabRef : undefined}
                        className={cn(
                          "relative -mb-px flex h-11 shrink-0 items-center whitespace-nowrap rounded-t-lg px-2.5 text-sm font-medium transition-colors duration-150",
                          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/30",
                          "after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors",
                          active
                            ? "font-semibold text-primary after:bg-primary"
                            : "text-muted-foreground after:bg-transparent hover:text-foreground",
                        )}
                      >
                        {section.title}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {/* End padding for the sideways-scrolling row on phones */}
            <span aria-hidden className="-ml-6 w-4 shrink-0 sm:-ml-8 sm:w-0" />
          </div>
          {/* Edge fades show there are more tabs to scroll to */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-background to-transparent transition-opacity",
              fade.left ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent transition-opacity",
              fade.right ? "opacity-100" : "opacity-0",
            )}
          />
        </div>

        <div
          key={current.id}
          id="settings-panel"
          role="tabpanel"
          aria-labelledby={`settings-tab-${current.id}`}
          className="page-enter min-w-0 max-w-5xl"
        >
          {content()}
        </div>
      </div>
    </div>
  )
}
