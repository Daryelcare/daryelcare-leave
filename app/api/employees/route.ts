import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// Map frontend column names to database column names
const columnMapping: Record<string, string> = {
  name: "name",
  employeeCode: "employee_code",
  jobTitle: "job_title",
  branch: "branch",
  daysTaken: "days_taken",
  daysRemaining: "days_remaining",
  hours: "hours",
  // Add any other columns that need mapping
}

export async function GET(request: Request) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const branch = searchParams.get("branch")
    const branches = searchParams.get("branches")
    const search = searchParams.get("search")?.toLowerCase()
    const page = Number.parseInt(searchParams.get("page") || "0")
    const pageSize = Number.parseInt(searchParams.get("pageSize") || "10")

    const sortColumn = searchParams.get("sortColumn") || "name"
    const sortOrder = searchParams.get("sortOrder") || "asc"

    // Log sorting parameters for debugging
    console.log(`Sorting: column=${sortColumn}, order=${sortOrder}`)

    // Calculate range for pagination
    const from = page * pageSize
    const to = from + pageSize - 1

    // Log pagination parameters for debugging
    console.log(`Pagination: page=${page}, pageSize=${pageSize}, from=${from}, to=${to}`)

    // Build the query
    let query = supabase.from("employees").select("*", { count: "exact" })

    // Apply filters
    if (branch && branch !== "all") {
      query = query.eq("branch", branch)
    } else if (branches) {
      // Handle multiple branches (comma-separated list)
      const branchList = branches.split(",")
      query = query.in("branch", branchList)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,employee_code.ilike.%${search}%`)
    }

    // Apply sorting
    if (sortColumn && sortOrder) {
      const dbColumn = columnMapping[sortColumn] || sortColumn
      const order = sortOrder.toLowerCase() === "desc" ? false : true
      query = query.order(dbColumn, { ascending: order })
    }

    // Apply pagination
    query = query.range(from, to)

    // Execute the query
    const { data, error, count } = await query

    if (error) {
      console.error("Supabase query error:", error)
      return NextResponse.json({ error: `Failed to fetch employees: ${error.message}` }, { status: 500 })
    }

    // For debugging
    console.log(
      `Fetched ${data?.length || 0} employees out of ${count || 0} total (requested from=${from}, to=${to}, pageSize=${pageSize})`,
    )

    // If no data is found, return an empty array with count 0
    if (!data || data.length === 0) {
      return NextResponse.json({
        data: [],
        total: count || 0,
      })
    }

    // Transform the data to match our frontend types
    const employees = data.map((emp) => ({
      id: emp.id,
      name: emp.name,
      employeeCode: emp.employee_code,
      jobTitle: emp.job_title,
      branch: emp.branch,
      daysTaken: emp.days_taken,
      daysRemaining: emp.days_remaining,
      hours: emp.hours, // Get hours directly from employees table
      email: emp.email || undefined,
      phone: emp.phone || undefined,
      status: emp.status,
    }))

    return NextResponse.json({
      data: employees,
      total: count || 0,
    })
  } catch (error) {
    console.error("Error fetching employees:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch employees",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Validate required fields
    if (!data.name || !data.employeeCode || !data.branch || !data.jobTitle) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Insert into Supabase
    const { data: newEmployee, error } = await supabase
      .from("employees")
      .insert({
        name: data.name,
        employee_code: data.employeeCode,
        job_title: data.jobTitle,
        branch: data.branch,
        days_taken: 0,
        days_remaining: data.totalLeaveDays || 28, // Use provided value or default
        hours: data.hours, // Store hours directly in employees table
        status: "active",
        email: data.email,
        phone: data.phone,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // Transform to match frontend types
    const transformedEmployee = {
      id: newEmployee.id,
      name: newEmployee.name,
      employeeCode: newEmployee.employee_code,
      jobTitle: newEmployee.job_title,
      branch: newEmployee.branch,
      daysTaken: newEmployee.days_taken,
      daysRemaining: newEmployee.days_remaining,
      hours: newEmployee.hours, // Get hours directly from employees table
      email: newEmployee.email || undefined,
      phone: newEmployee.phone || undefined,
      status: newEmployee.status,
    }

    return NextResponse.json(transformedEmployee, { status: 201 })
  } catch (error) {
    console.error("Error creating employee:", error)
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 })
  }
}
