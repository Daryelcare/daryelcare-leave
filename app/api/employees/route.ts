import { NextResponse } from "next/server"
import { allowanceColumnExists } from "@/lib/column-probe"
import { STANDARD_ENTITLEMENT } from "@/lib/balances"
import { supabase } from "@/lib/db"
import { allowedBranches, canAccessBranch, requireUser, requirePermission } from "@/lib/server-auth"

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
    const auth = await requireUser(request)
    if (auth.response) return auth.response
    const allowed = allowedBranches(auth.user)
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
    // Managers only see their own branches
    if (branch && branch !== "all") {
      if (!canAccessBranch(auth.user, branch)) return NextResponse.json({ data: [], total: 0 })
      query = query.eq("branch", branch)
    } else if (branches) {
      const branchList = branches.split(",").filter((b) => canAccessBranch(auth.user, b))
      query = query.in("branch", branchList.length ? branchList : ["\u0000"])
    } else if (allowed) {
      query = query.in("branch", allowed.length ? allowed : ["\u0000"])
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
      return NextResponse.json({ error: "Couldn't load employees. Please try again." }, { status: 500 })
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
    return NextResponse.json({ error: "Couldn't load employees. Please try again." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission(request, "employees_edit")
    if (auth.response) return auth.response
    const data = await request.json()

    // Validate required fields
    if (!data.name || !data.employeeCode || !data.branch || !data.jobTitle) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    if (!canAccessBranch(auth.user, data.branch)) {
      return NextResponse.json({ error: "You can only add employees to your own branches" }, { status: 403 })
    }

    // Their yearly allowance (whole days; 28 unless set)
    const raw = data.totalLeaveDays ?? data.annualAllowance
    const allowance = raw === undefined || raw === null || raw === "" ? STANDARD_ENTITLEMENT : Number(raw)
    if (!Number.isInteger(allowance) || allowance < 0 || allowance > 366) {
      return NextResponse.json({ error: "The annual allowance must be a whole number of days from 0 to 366" }, { status: 400 })
    }
    const tracking = await allowanceColumnExists()

    // Insert into Supabase
    const { data: newEmployee, error } = await supabase
      .from("employees")
      .insert({
        name: data.name,
        employee_code: data.employeeCode,
        job_title: data.jobTitle,
        branch: data.branch,
        days_taken: 0,
        days_remaining: allowance, // A new starter has their full allowance
        ...(tracking ? { annual_allowance: allowance === STANDARD_ENTITLEMENT ? null : allowance } : {}),
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
