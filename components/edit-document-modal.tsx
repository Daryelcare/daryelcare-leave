"use client"

import { ShieldCheck } from "lucide-react"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format, parse } from "date-fns"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import type { EmployeeDocument } from "@/lib/types"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Form schema with optional expiry dates
const formSchema = z.object({
  status: z.string().min(1, { message: "Status is required" }),
  country: z.string().min(1, { message: "Country is required" }),
  documentType: z.string().min(1, { message: "Document type is required" }),
  customDocumentType: z.string().optional(),
  expiryDate: z.date().optional().nullable(),
  isSponsored: z.boolean().default(false),
  is20Hours: z.boolean().default(false),
})

// What the form fields hold, and what validation turns them into
type FormInput = z.input<typeof formSchema>
type FormValues = z.output<typeof formSchema>

interface EditDocumentModalProps {
  document: EmployeeDocument
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Which document to open on. Right to work unless another is asked for. */
  initialTab?: "rightToWork" | "passport" | "brp" | "other"
}

// Parse a DD/MM/YYYY date string to a Date
const parseDate = (dateString: string | null) => {
  if (!dateString) return null
  return parse(dateString, "dd/MM/yyyy", new Date())
}

export function EditDocumentModal({
  document,
  open,
  onOpenChange,
  initialTab = "rightToWork",
}: EditDocumentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCustomDocType, setShowCustomDocType] = useState(false)
  const [activeTab, setActiveTab] = useState<string>(initialTab)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Initialize form
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: document.status,
      country: document.country ?? "",
      documentType: initialTab,
      customDocumentType: document.otherDocumentType || "",
      expiryDate: null,
      isSponsored: document.isSponsored || false,
      is20Hours: document.is20Hours || false,
    },
  })

  // Watch document type to show custom input when "other" is selected
  const documentType = form.watch("documentType")

  // Update UI when document type changes
  useEffect(() => {
    setShowCustomDocType(documentType === "other")
  }, [documentType])

  // Stable function from react-hook-form, so the effect below can depend on it
  const { setValue } = form

  // Update expiry date when tab changes
  useEffect(() => {
    // Clear the expiry date when changing tabs
    setValue("expiryDate", null)

    // Set the expiry date based on the active tab
    if (activeTab === "passport" && document.passportExpiry) {
      setValue("expiryDate", parseDate(document.passportExpiry))
    } else if (activeTab === "rightToWork" && document.rightToWorkExpiry) {
      setValue("expiryDate", parseDate(document.rightToWorkExpiry))
    } else if (activeTab === "brp" && document.brpExpiry) {
      setValue("expiryDate", parseDate(document.brpExpiry))
    } else if (activeTab === "other" && document.otherDocumentExpiry) {
      setValue("expiryDate", parseDate(document.otherDocumentExpiry))
      setValue("customDocumentType", document.otherDocumentType || "")
    }
    // Only when the tab or the saved dates change. Depending on the whole form
    // or document object re-ran this on every render, which overwrote a date
    // while it was being typed.
  }, [
    activeTab,
    document.passportExpiry,
    document.rightToWorkExpiry,
    document.brpExpiry,
    document.otherDocumentExpiry,
    document.otherDocumentType,
    setValue,
  ])

  // Calculate days left between today and a future date
  const calculateDaysLeft = (futureDate: Date | null) => {
    if (!futureDate) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffTime = futureDate.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  // Handle document type selection
  const handleDocumentTypeSelect = (type: string) => {
    form.setValue("documentType", type)
    setActiveTab(type)
  }

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true)
    try {
      // Calculate days left for expiry date (if provided)
      const daysLeft = data.expiryDate ? calculateDaysLeft(data.expiryDate) : null

      // Prepare update data
      const updateData: Record<string, unknown> = {
        status: data.status,
        country: data.country,
        isSponsored: data.isSponsored,
        is20Hours: data.is20Hours,
      }

      // Update the specific document type fields
      if (activeTab === "passport" && data.expiryDate) {
        updateData.passportExpiry = format(data.expiryDate, "dd/MM/yyyy")
        updateData.passportDaysLeft = daysLeft
      } else if (activeTab === "rightToWork" && data.expiryDate) {
        updateData.rightToWorkExpiry = format(data.expiryDate, "dd/MM/yyyy")
        updateData.rightToWorkDaysLeft = daysLeft
      } else if (activeTab === "brp" && data.expiryDate) {
        updateData.brpExpiry = format(data.expiryDate, "dd/MM/yyyy")
        updateData.brpDaysLeft = daysLeft
      } else if (activeTab === "other" && data.expiryDate) {
        updateData.otherDocumentType = data.customDocumentType || "Other document"
        updateData.otherDocumentExpiry = format(data.expiryDate, "dd/MM/yyyy")
        updateData.otherDocumentDaysLeft = daysLeft
      }

      await fetchWithAuth(`/api/documents/${document.id}`, {
        method: "PUT",
        body: JSON.stringify(updateData),
      })

      toast({
        title: "Success",
        description: "Document updated successfully",
      })

      // Close modal
      onOpenChange(false)

      // Refresh documents list
      queryClient.invalidateQueries({ queryKey: ["documents"] })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to update document: ${handleApiError(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Edit document</DialogTitle>
          <DialogDescription>Edit document details for {document.employeeName}.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs value={activeTab} onValueChange={handleDocumentTypeSelect} className="w-full">
              <TabsList className="mb-4 grid grid-cols-[1.5fr_1fr_1fr_1fr]">
                <TabsTrigger value="rightToWork" className="gap-1.5 font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Right to work
                </TabsTrigger>
                <TabsTrigger value="passport">Passport</TabsTrigger>
                <TabsTrigger value="brp">BRP</TabsTrigger>
                <TabsTrigger value="other">Other</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Hidden field to store the document type */}
            <FormField
              control={form.control}
              name="documentType"
              render={({ field }) => (
                <FormItem className="hidden">
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            {showCustomDocType && (
              <FormField
                control={form.control}
                name="customDocumentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter document name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="BRITISH">BRITISH</SelectItem>
                        <SelectItem value="EU">EU</SelectItem>
                        <SelectItem value="NON-EU">NON-EU</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input placeholder="Country of origin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="expiryDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Expiry date</FormLabel>
                  <FormControl>
                    <DatePicker value={field.value || undefined} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isSponsored"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border/80 bg-card px-3.5 py-3">
                  <div className="space-y-0.5">
                    <FormLabel>Sponsored employee</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Mark if this employee is sponsored and requires additional tracking
                    </div>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {form.watch("isSponsored") && (
              <FormField
                control={form.control}
                name="is20Hours"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border/80 bg-card px-3.5 py-3">
                    <div className="space-y-0.5">
                      <FormLabel>20-hour restriction</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Mark if this sponsored employee is restricted to 20 hours per week
                      </div>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
