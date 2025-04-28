import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id

    // Fetch the employee from Supabase
    const { data, error } = await supabase.from("employees").select("*").eq("id", id).single()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    // Transform the data to match our frontend types
    const employee = {
      id: data.id,
      name: data.name,
      employeeCode: data.employee_code,
      jobTitle: data.job_title,
      branch: data.branch,
      daysTaken: data.days_taken,
      daysRemaining: data.days_remaining,
      hours: data.hours, // Get hours directly from employees table
      email: data.email || undefined,
      phone: data.phone || undefined,
      status: data.status,
    }

    return NextResponse.json(employee)
  } catch (error) {
    console.error("Error fetching employee:", error)
    return NextResponse.json({ error: "Failed to fetch employee" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const data = await request.json()

    // Validate required fields
    if (!data.name || !data.employeeCode || !data.branch || !data.jobTitle) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Update the employee in Supabase
    const { data: updatedEmployee, error } = await supabase
      .from("employees")
      .update({
        name: data.name,
        employee_code: data.employeeCode,
        job_title: data.jobTitle,
        branch: data.branch,
        days_taken: data.daysTaken,
        days_remaining: data.daysRemaining,
        hours: data.hours, // Store hours directly in employees table
        email: data.email || null,
        phone: data.phone || null,
        status: data.status,
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      throw error
    }

    // Transform to match frontend types
    const transformedEmployee = {
      id: updatedEmployee.id,
      name: updatedEmployee.name,
      employeeCode: updatedEmployee.employee_code,
      jobTitle: updatedEmployee.job_title,
      branch: updatedEmployee.branch,
      daysTaken: updatedEmployee.days_taken,
      daysRemaining: updatedEmployee.days_remaining,
      hours: updatedEmployee.hours, // Get hours directly from employees table
      email: updatedEmployee.email || undefined,
      phone: updatedEmployee.phone || undefined,
      status: updatedEmployee.status,
    }

    return NextResponse.json(transformedEmployee)
  } catch (error) {
    console.error("Error updating employee:", error)
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id

    // Delete the employee from Supabase
    const { error } = await supabase.from("employees").delete().eq("id", id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting employee:", error)
    return NextResponse.json({ error: "Failed to delete employee" }, { status: 500 })
  }
}
