"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarIcon } from "lucide-react"
import { format, parse } from "date-fns"
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
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithAuth, handleApiError } from "@/lib/api-utils"
import { cn } from "@/lib/utils"
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

type FormValues = z.infer<typeof formSchema>

interface EditDocumentModalProps {
  document: EmployeeDocument
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditDocumentModal({ document, open, onOpenChange }: EditDocumentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCustomDocType, setShowCustomDocType] = useState(false)
  const [activeTab, setActiveTab] = useState("passport")
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Parse date strings to Date objects
  const parseDate = (dateString: string | null) => {
    if (!dateString) return null
    // Parse date in format DD/MM/YYYY
    return parse(dateString, "dd/MM/yyyy", new Date())
  }

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: document.status,
      country: document.country,
      documentType: "passport",
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

  // Update expiry date when tab changes
  useEffect(() => {
    // Clear the expiry date when changing tabs
    form.setValue("expiryDate", null)

    // Set the expiry date based on the active tab
    if (activeTab === "passport" && document.passportExpiry) {
      form.setValue("expiryDate", parseDate(document.passportExpiry))
    } else if (activeTab === "rightToWork" && document.rightToWorkExpiry) {
      form.setValue("expiryDate", parseDate(document.rightToWorkExpiry))
    } else if (activeTab === "brp" && document.brpExpiry) {
      form.setValue("expiryDate", parseDate(document.brpExpiry))
    } else if (activeTab === "other" && document.otherDocumentExpiry) {
      form.setValue("expiryDate", parseDate(document.otherDocumentExpiry))
      form.setValue("customDocumentType", document.otherDocumentType || "")
    }
  }, [activeTab, document, form])

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
      const updateData: any = {
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
        updateData.otherDocumentType = data.customDocumentType || "Other Document"
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
          <DialogTitle>Edit Document</DialogTitle>
          <DialogDescription>Edit document details for {document.employeeName}.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs value={activeTab} onValueChange={handleDocumentTypeSelect} className="w-full">
              <TabsList className="grid grid-cols-4 mb-4">
                <TabsTrigger value="passport">Passport</TabsTrigger>
                <TabsTrigger value="rightToWork">Right to Work</TabsTrigger>
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
                    <FormLabel>Document Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter document name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
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
                  <FormLabel>Expiry Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                          {field.value ? format(field.value, "PPP") : <span>Pick a date (optional)</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value || undefined}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isSponsored"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Sponsored Employee</FormLabel>
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
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>20 Hours Restriction</FormLabel>
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
