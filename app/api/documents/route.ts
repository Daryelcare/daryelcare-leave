import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: Request) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const branch = searchParams.get("branch")
    const search = searchParams.get("search")?.toLowerCase()
    const employeeId = searchParams.get("employeeId")
    const status = searchParams.get("status")
    const sponsoredOnly = searchParams.get("sponsoredOnly") === "true"

    // Get sorting parameters
    const sortColumn = searchParams.get("sortColumn")
    const sortDirection = searchParams.get("sortDirection")

    // Build the query
    let query = supabase.from("documents").select("*")

    // Apply filters
    if (branch && branch !== "all") {
      query = query.eq("branch", branch)
    }

    if (search) {
      query = query.or(`employee_name.ilike.%${search}%,country.ilike.%${search}%`)
    }

    if (employeeId) {
      query = query.eq("employee_id", employeeId)
    }

    // Filter by sponsored status if requested
    if (sponsoredOnly) {
      query = query.eq("is_sponsored", true)
    }

    // Apply status filter
    if (status && status !== "all") {
      switch (status) {
        case "expired":
          query = query.or(
            "passport_days_left.lte.0,right_to_work_days_left.lte.0,brp_days_left.lte.0,other_document_days_left.lte.0",
          )
          break
        case "expiring7":
          query = query.or(
            "passport_days_left.gt.0,passport_days_left.lte.7," +
              "right_to_work_days_left.gt.0,right_to_work_days_left.lte.7," +
              "brp_days_left.gt.0,brp_days_left.lte.7," +
              "other_document_days_left.gt.0,other_document_days_left.lte.7",
          )
          break
        case "expiring30":
          query = query.or(
            "passport_days_left.gt.7,passport_days_left.lte.30," +
              "right_to_work_days_left.gt.7,right_to_work_days_left.lte.30," +
              "brp_days_left.gt.7,brp_days_left.lte.30," +
              "other_document_days_left.gt.7,other_document_days_left.lte.30",
          )
          break
        case "expiring90":
          query = query.or(
            "passport_days_left.gt.30,passport_days_left.lte.90," +
              "right_to_work_days_left.gt.30,right_to_work_days_left.lte.90," +
              "brp_days_left.gt.30,brp_days_left.lte.90," +
              "other_document_days_left.gt.30,other_document_days_left.lte.90",
          )
          break
        case "valid":
          query = query.and(
            "passport_days_left.gt.90,right_to_work_days_left.gt.90,brp_days_left.gt.90,other_document_days_left.gt.90",
          )
          break
      }
    }

    // Apply sorting if provided
    if (sortColumn && sortDirection) {
      // Map frontend column names to database column names if needed
      const dbColumn = sortColumn.includes("_") ? sortColumn : sortColumn.replace(/([A-Z])/g, "_$1").toLowerCase()
      query = query.order(dbColumn, { ascending: sortDirection === "asc" })
    } else {
      // Default sorting by employee_name
      query = query.order("employee_name", { ascending: true })
    }

    // Execute the query
    const { data, error } = await query

    if (error) {
      throw error
    }

    // Transform the data to match our frontend types
    const documents = data.map((doc) => ({
      id: doc.id,
      employeeId: doc.employee_id,
      employeeName: doc.employee_name,
      branch: doc.branch,
      status: doc.status,
      country: doc.country,

      passportExpiry: doc.passport_expiry || null,
      passportDaysLeft: doc.passport_days_left || null,

      rightToWorkExpiry: doc.right_to_work_expiry || null,
      rightToWorkDaysLeft: doc.right_to_work_days_left || null,

      brpExpiry: doc.brp_expiry || null,
      brpDaysLeft: doc.brp_days_left || null,

      otherDocumentType: doc.other_document_type || null,
      otherDocumentExpiry: doc.other_document_expiry || null,
      otherDocumentDaysLeft: doc.other_document_days_left || null,

      isSponsored: doc.is_sponsored || false,
      is20Hours: doc.is_20_hours || false,
    }))

    return NextResponse.json(documents)
  } catch (error) {
    console.error("Error fetching documents:", error)
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 })
  }
}

// Update the POST method to handle the new form structure
export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Validate required fields
    if (!data.employeeId || !data.employeeName || !data.branch || !data.status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Check if document already exists for this employee
    const { data: existingDoc, error: checkError } = await supabase
      .from("documents")
      .select("*")
      .eq("employee_id", data.employeeId)
      .maybeSingle()

    if (checkError) {
      throw checkError
    }

    // Prepare document data with all fields
    const documentData: any = {
      employee_id: data.employeeId,
      employee_name: data.employeeName,
      branch: data.branch,
      status: data.status,
      country: data.country,
      is_sponsored: data.isSponsored || false,
      is_20_hours: data.is20Hours || false,
    }

    // Add passport data if provided
    if (data.passportExpiry) {
      documentData.passport_expiry = data.passportExpiry
      documentData.passport_days_left = data.passportDaysLeft
    }

    // Add right to work data if provided
    if (data.rightToWorkExpiry) {
      documentData.right_to_work_expiry = data.rightToWorkExpiry
      documentData.right_to_work_days_left = data.rightToWorkDaysLeft
    }

    // Add BRP data if provided
    if (data.brpExpiry) {
      documentData.brp_expiry = data.brpExpiry
      documentData.brp_days_left = data.brpDaysLeft
    }

    // Add other document data if provided
    if (data.otherDocumentExpiry) {
      documentData.other_document_type = data.otherDocumentType || "Other Document"
      documentData.other_document_expiry = data.otherDocumentExpiry
      documentData.other_document_days_left = data.otherDocumentDaysLeft
    }

    let result

    if (existingDoc) {
      // Update existing document
      const { data: updatedDoc, error: updateError } = await supabase
        .from("documents")
        .update(documentData)
        .eq("id", existingDoc.id)
        .select()
        .single()

      if (updateError) {
        throw updateError
      }

      result = updatedDoc
    } else {
      // Insert new document
      const { data: newDocument, error } = await supabase.from("documents").insert(documentData).select().single()

      if (error) {
        throw error
      }

      result = newDocument
    }

    // Transform to match frontend types
    const transformedDocument = {
      id: result.id,
      employeeId: result.employee_id,
      employeeName: result.employee_name,
      branch: result.branch,
      status: result.status,
      country: result.country,

      passportExpiry: result.passport_expiry || null,
      passportDaysLeft: result.passport_days_left || null,

      rightToWorkExpiry: result.right_to_work_expiry || null,
      rightToWorkDaysLeft: result.right_to_work_days_left || null,

      brpExpiry: result.brp_expiry || null,
      brpDaysLeft: result.brp_days_left || null,

      otherDocumentType: result.other_document_type || null,
      otherDocumentExpiry: result.other_document_expiry || null,
      otherDocumentDaysLeft: result.other_document_days_left || null,

      isSponsored: result.is_sponsored || false,
      is20Hours: result.is_20_hours || false,
    }

    return NextResponse.json(transformedDocument, { status: existingDoc ? 200 : 201 })
  } catch (error) {
    console.error("Error creating/updating document:", error)
    return NextResponse.json({ error: "Failed to create/update document" }, { status: 500 })
  }
}

// Helper function to calculate days left
function calculateDaysLeft(dateString: string): number | null {
  if (!dateString) return null

  // Parse date in format DD/MM/YYYY
  const parts = dateString.split("/")
  if (parts.length !== 3) return null

  const day = Number.parseInt(parts[0], 10)
  const month = Number.parseInt(parts[1], 10) - 1 // Month is 0-indexed in JavaScript
  const year = Number.parseInt(parts[2], 10)

  const expiryDate = new Date(year, month, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diffTime = expiryDate.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}
