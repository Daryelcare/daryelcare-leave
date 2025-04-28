"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarIcon, CheckCircle2 } from "lucide-react"
import { format } from "date-fns"
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
import { useQuery } from "@tanstack/react-query"
import { Switch } from "@/components/ui/switch"
import type { EmployeeDocument } from "@/lib/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// List of all countries
const countries = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "East Timor",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Korea, North",
  "Korea, South",
  "Kosovo",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
]

// Form schema with all document types
const formSchema = z.object({
  employeeId: z.string().min(1, { message: "Employee is required" }),
  status: z.string().min(1, { message: "Status is required" }),
  country: z.string().min(1, { message: "Country is required" }),

  // Passport
  passportExpiryDate: z.date().optional().nullable(),

  // Right to Work
  rightToWorkExpiryDate: z.date().optional().nullable(),

  // BRP
  brpExpiryDate: z.date().optional().nullable(),

  // Other Document
  otherDocumentType: z.string().optional(),
  otherExpiryDate: z.date().optional().nullable(),

  // Sponsored status
  isSponsored: z.boolean().default(false),
  is20Hours: z.boolean().default(false),
})

type FormValues = z.infer<typeof formSchema>

interface AddDocumentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddDocumentModal({ open, onOpenChange }: AddDocumentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [existingDocument, setExistingDocument] = useState<EmployeeDocument | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: "",
      status: "NON-EU",
      country: "",
      passportExpiryDate: null,
      rightToWorkExpiryDate: null,
      brpExpiryDate: null,
      otherDocumentType: "",
      otherExpiryDate: null,
      isSponsored: false,
      is20Hours: false,
    },
  })

  // Watch status to handle special cases
  const status = form.watch("status")
  const employeeId = form.watch("employeeId")
  const isSponsored = form.watch("isSponsored")

  // Auto-fill country when status is BRITISH
  useEffect(() => {
    if (status === "BRITISH") {
      form.setValue("country", "United Kingdom")
    }
  }, [status, form])

  // Fetch ALL employees without pagination
  const { data: employeesResponse = { data: [], total: 0 }, isLoading: isLoadingEmployees } = useQuery({
    queryKey: ["employees", "all"],
    queryFn: async () => {
      try {
        // Use a very large pageSize to ensure we get all employees in one request
        const params = new URLSearchParams()
        params.append("pageSize", "1000") // Set a very large page size to get all employees

        const response = await fetchWithAuth(`/api/employees?${params.toString()}`)
        return response || { data: [], total: 0 }
      } catch (error) {
        console.error("Error fetching employees:", error)
        return { data: [], total: 0 }
      }
    },
    enabled: open,
  })

  const employees = employeesResponse?.data || []

  // Fetch existing document for the selected employee
  useEffect(() => {
    if (!employeeId) {
      setExistingDocument(null)
      return
    }

    const fetchExistingDocument = async () => {
      try {
        const response = await fetchWithAuth(`/api/documents?employeeId=${employeeId}`)
        if (response && response.length > 0) {
          setExistingDocument(response[0])

          // Set form values from existing document
          form.setValue("status", response[0].status)
          form.setValue("country", response[0].country)
          form.setValue("isSponsored", response[0].isSponsored || false)
          form.setValue("is20Hours", response[0].is20Hours || false)

          // Set passport expiry date
          if (response[0].passportExpiry) {
            form.setValue("passportExpiryDate", parseDate(response[0].passportExpiry))
          }

          // Set right to work expiry date
          if (response[0].rightToWorkExpiry) {
            form.setValue("rightToWorkExpiryDate", parseDate(response[0].rightToWorkExpiry))
          }

          // Set BRP expiry date
          if (response[0].brpExpiry) {
            form.setValue("brpExpiryDate", parseDate(response[0].brpExpiry))
          }

          // Set other document details
          if (response[0].otherDocumentExpiry) {
            form.setValue("otherExpiryDate", parseDate(response[0].otherDocumentExpiry))
            form.setValue("otherDocumentType", response[0].otherDocumentType || "")
          }
        } else {
          setExistingDocument(null)
        }
      } catch (error) {
        console.error("Error fetching existing document:", error)
        setExistingDocument(null)
      }
    }

    fetchExistingDocument()
  }, [employeeId, form])

  // Parse date string to Date object
  function parseDate(dateString: string): Date | null {
    if (!dateString) return null

    // Parse date in format DD/MM/YYYY
    const parts = dateString.split("/")
    if (parts.length !== 3) return null

    const day = Number.parseInt(parts[0], 10)
    const month = Number.parseInt(parts[1], 10) - 1 // Month is 0-indexed in JavaScript
    const year = Number.parseInt(parts[2], 10)

    return new Date(year, month, day)
  }

  // Calculate days left between today and a future date
  const calculateDaysLeft = (futureDate: Date | null) => {
    if (!futureDate) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffTime = futureDate.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true)
    setSuccessMessage(null)

    try {
      // Find the selected employee to get their name and branch
      const selectedEmployee = employees.find((emp) => emp.id === data.employeeId)

      if (!selectedEmployee) {
        throw new Error("Selected employee not found")
      }

      // Prepare document data with all expiry dates
      const documentData = {
        employeeId: data.employeeId,
        employeeName: selectedEmployee.name,
        branch: selectedEmployee.branch,
        status: data.status,
        country: data.country,
        isSponsored: data.isSponsored || false,
        is20Hours: data.is20Hours || false,

        // Include all document types and their expiry dates
        passportExpiry: data.passportExpiryDate ? format(data.passportExpiryDate, "dd/MM/yyyy") : null,
        passportDaysLeft: data.passportExpiryDate ? calculateDaysLeft(data.passportExpiryDate) : null,

        rightToWorkExpiry: data.rightToWorkExpiryDate ? format(data.rightToWorkExpiryDate, "dd/MM/yyyy") : null,
        rightToWorkDaysLeft: data.rightToWorkExpiryDate ? calculateDaysLeft(data.rightToWorkExpiryDate) : null,

        brpExpiry: data.brpExpiryDate ? format(data.brpExpiryDate, "dd/MM/yyyy") : null,
        brpDaysLeft: data.brpExpiryDate ? calculateDaysLeft(data.brpExpiryDate) : null,

        otherDocumentType: data.otherDocumentType || null,
        otherDocumentExpiry: data.otherExpiryDate ? format(data.otherExpiryDate, "dd/MM/yyyy") : null,
        otherDocumentDaysLeft: data.otherExpiryDate ? calculateDaysLeft(data.otherExpiryDate) : null,
      }

      // Send the request to save all document information
      await fetchWithAuth("/api/documents/save-all", {
        method: "POST",
        body: JSON.stringify(documentData),
      })

      // Set success message
      setSuccessMessage("All document information saved successfully")

      // Refresh documents list
      queryClient.invalidateQueries({ queryKey: ["documents"] })

      // Refresh the existing document data
      if (employeeId) {
        const response = await fetchWithAuth(`/api/documents?employeeId=${employeeId}`)
        if (response && response.length > 0) {
          setExistingDocument(response[0])
        }
      }

      toast({
        title: "Success",
        description: "All document information saved successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to save documents: ${handleApiError(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Format date for display
  const formatExistingDate = (dateString: string | null | undefined, daysLeft: number | null | undefined) => {
    if (!dateString) return "N/A"
    return `${dateString} (${daysLeft} days left)`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Document</DialogTitle>
          <DialogDescription>
            Add documents for an employee. You can add multiple document types at once.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingEmployees}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an employee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[300px]">
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name} ({employee.branch})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {existingDocument && (
              <Alert>
                <AlertTitle>Existing Documents</AlertTitle>
                <AlertDescription>
                  This employee already has documents. You can update any of the document types below.
                </AlertDescription>
              </Alert>
            )}

            {successMessage && (
              <Alert className="bg-green-50 border-green-200 text-green-800">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
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
                    <Select onValueChange={field.onChange} value={field.value} disabled={status === "BRITISH"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[200px]">
                        {countries.map((country) => (
                          <SelectItem key={country} value={country}>
                            {country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border rounded-md p-4">
              <h3 className="text-sm font-medium mb-3">Document Expiry Dates</h3>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {/* Passport */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium">Passport</h4>
                    {existingDocument?.passportExpiry && (
                      <span className="text-xs text-muted-foreground">Current: {existingDocument.passportExpiry}</span>
                    )}
                  </div>
                  <FormField
                    control={form.control}
                    name="passportExpiryDate"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal text-sm h-9",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                {field.value ? format(field.value, "dd/MM/yyyy") : <span>Select date</span>}
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
                </div>

                {/* Right to Work */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium">Right to Work</h4>
                    {existingDocument?.rightToWorkExpiry && (
                      <span className="text-xs text-muted-foreground">
                        Current: {existingDocument.rightToWorkExpiry}
                      </span>
                    )}
                  </div>
                  <FormField
                    control={form.control}
                    name="rightToWorkExpiryDate"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal text-sm h-9",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                {field.value ? format(field.value, "dd/MM/yyyy") : <span>Select date</span>}
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
                </div>

                {/* BRP */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium">BRP</h4>
                    {existingDocument?.brpExpiry && (
                      <span className="text-xs text-muted-foreground">Current: {existingDocument.brpExpiry}</span>
                    )}
                  </div>
                  <FormField
                    control={form.control}
                    name="brpExpiryDate"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal text-sm h-9",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                {field.value ? format(field.value, "dd/MM/yyyy") : <span>Select date</span>}
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
                </div>

                {/* Other Document */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Other Document</h4>
                    {existingDocument?.otherDocumentExpiry && (
                      <span className="text-xs text-muted-foreground">
                        Current: {existingDocument.otherDocumentType}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="otherDocumentType"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Input placeholder="Document name" className="h-9 text-sm" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="otherExpiryDate"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal text-sm h-9",
                                    !field.value && "text-muted-foreground",
                                  )}
                                >
                                  {field.value ? format(field.value, "dd/MM/yyyy") : <span>Date</span>}
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
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="isSponsored"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 rounded-lg border p-2 shadow-sm h-full">
                    <div className="flex-1">
                      <FormLabel className="text-sm">Sponsored Employee</FormLabel>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {isSponsored && (
                <FormField
                  control={form.control}
                  name="is20Hours"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 rounded-lg border p-2 shadow-sm h-full">
                      <div className="flex-1">
                        <FormLabel className="text-sm">20 Hours Restriction</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
              >
                {isSubmitting ? "Saving..." : "Save All Documents"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
