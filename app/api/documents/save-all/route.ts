import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

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

    // Prepare the document data
    const documentData = {
      employee_id: data.employeeId,
      employee_name: data.employeeName,
      branch: data.branch,
      status: data.status,
      country: data.country,
      is_sponsored: data.isSponsored || false,
      is_20_hours: data.is20Hours || false,

      // Passport
      passport_expiry: data.passportExpiry || null,
      passport_days_left: data.passportDaysLeft || null,

      // Right to Work
      right_to_work_expiry: data.rightToWorkExpiry || null,
      right_to_work_days_left: data.rightToWorkDaysLeft || null,

      // BRP
      brp_expiry: data.brpExpiry || null,
      brp_days_left: data.brpDaysLeft || null,

      // Other Document
      other_document_type: data.otherDocumentType || null,
      other_document_expiry: data.otherDocumentExpiry || null,
      other_document_days_left: data.otherDocumentDaysLeft || null,
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
      const { data: newDocument, error: insertError } = await supabase
        .from("documents")
        .insert(documentData)
        .select()
        .single()

      if (insertError) {
        throw insertError
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
    console.error("Error saving documents:", error)
    return NextResponse.json({ error: "Failed to save documents" }, { status: 500 })
  }
}
