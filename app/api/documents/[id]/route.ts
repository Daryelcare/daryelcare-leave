import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id

    // Fetch the document from Supabase
    const { data, error } = await supabase.from("documents").select("*").eq("id", id).single()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Transform the data to match our frontend types
    const document = {
      id: data.id,
      employeeId: data.employee_id,
      employeeName: data.employee_name,
      branch: data.branch,
      status: data.status,
      country: data.country,

      passportExpiry: data.passport_expiry || null,
      passportDaysLeft: data.passport_days_left || null,

      rightToWorkExpiry: data.right_to_work_expiry || null,
      rightToWorkDaysLeft: data.right_to_work_days_left || null,

      brpExpiry: data.brp_expiry || null,
      brpDaysLeft: data.brp_days_left || null,

      otherDocumentType: data.other_document_type || null,
      otherDocumentExpiry: data.other_document_expiry || null,
      otherDocumentDaysLeft: data.other_document_days_left || null,

      isSponsored: data.is_sponsored || false,
      is20Hours: data.is_20_hours || false,
    }

    return NextResponse.json(document)
  } catch (error) {
    console.error("Error fetching document:", error)
    return NextResponse.json({ error: "Failed to fetch document" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const data = await request.json()

    // Validate required fields
    if (!data.status || !data.country) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get the existing document to avoid overwriting fields
    const { data: existingDoc, error: getError } = await supabase.from("documents").select("*").eq("id", id).single()

    if (getError) {
      throw getError
    }

    // Prepare update data - only include fields that are provided
    const updateData: any = {
      status: data.status,
      country: data.country,
      is_sponsored: data.isSponsored !== undefined ? data.isSponsored : existingDoc.is_sponsored,
      is_20_hours: data.is20Hours !== undefined ? data.is20Hours : existingDoc.is_20_hours,
    }

    // Only update the fields that are provided, preserving existing values
    if (data.passportExpiry !== undefined) {
      updateData.passport_expiry = data.passportExpiry
      updateData.passport_days_left = data.passportDaysLeft
    }

    if (data.rightToWorkExpiry !== undefined) {
      updateData.right_to_work_expiry = data.rightToWorkExpiry
      updateData.right_to_work_days_left = data.rightToWorkDaysLeft
    }

    if (data.brpExpiry !== undefined) {
      updateData.brp_expiry = data.brpExpiry
      updateData.brp_days_left = data.brpDaysLeft
    }

    if (data.otherDocumentExpiry !== undefined) {
      updateData.other_document_type = data.otherDocumentType || existingDoc.other_document_type
      updateData.other_document_expiry = data.otherDocumentExpiry
      updateData.other_document_days_left = data.otherDocumentDaysLeft
    }

    // Update the document in Supabase
    const { data: updatedDocument, error } = await supabase
      .from("documents")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      throw error
    }

    // Transform to match frontend types
    const transformedDocument = {
      id: updatedDocument.id,
      employeeId: updatedDocument.employee_id,
      employeeName: updatedDocument.employee_name,
      branch: updatedDocument.branch,
      status: updatedDocument.status,
      country: updatedDocument.country,

      passportExpiry: updatedDocument.passport_expiry || null,
      passportDaysLeft: updatedDocument.passport_days_left || null,

      rightToWorkExpiry: updatedDocument.right_to_work_expiry || null,
      rightToWorkDaysLeft: updatedDocument.right_to_work_days_left || null,

      brpExpiry: updatedDocument.brp_expiry || null,
      brpDaysLeft: updatedDocument.brp_days_left || null,

      otherDocumentType: updatedDocument.other_document_type || null,
      otherDocumentExpiry: updatedDocument.other_document_expiry || null,
      otherDocumentDaysLeft: updatedDocument.other_document_days_left || null,

      isSponsored: updatedDocument.is_sponsored || false,
      is20Hours: updatedDocument.is_20_hours || false,
    }

    return NextResponse.json(transformedDocument)
  } catch (error) {
    console.error("Error updating document:", error)
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id

    // Delete the document from Supabase
    const { error } = await supabase.from("documents").delete().eq("id", id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting document:", error)
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 })
  }
}
