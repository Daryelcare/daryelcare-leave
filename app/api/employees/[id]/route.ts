import { NextResponse } from "next/server"
import { supabase } from "@/lib/db"
import { canAccessBranch, requireUser, type RequestUser, requirePermission } from "@/lib/server-auth"
import { allowanceColumnExists } from "@/lib/column-probe"
import { applyBalanceCheck } from "@/lib/balance-server"
import { STANDARD_ENTITLEMENT } from "@/lib/balances"

/** A whole-day allowance from the request, or null for the standard 28; undefined when not sent */
function parseAllowance(value: unknown): number | null | undefined | "bad" {
  if (value === undefined) return undefined
  if (value === null || value === "") return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > 366) return "bad"
  return n === STANDARD_ENTITLEMENT ? null : n
}

/** The frontend shape of an employees row */
function toEmployee(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    employeeCode: row.employee_code,
    jobTitle: row.job_title,
    branch: row.branch,
    daysTaken: row.days_taken,
    daysRemaining: row.days_remaining,
    hours: row.hours,
    email: row.email || undefined,
    phone: row.phone || undefined,
    status: row.status,
    // Present once the automatic leave year update has been run
    ...("annual_allowance" in row
      ? { allowanceTracking: true, annualAllowance: (row.annual_allowance as number | null) ?? STANDARD_ENTITLEMENT }
      : { allowanceTracking: false }),
  }
}

/** The employee's branch check: a response to send instead, or null when allowed */
async function branchCheck(id: string, user: RequestUser) {
  const { data, error } = await supabase.from("employees").select("branch").eq("id", id).maybeSingle()
  if (error) throw error
  if (!data) return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  if (!canAccessBranch(user, data.branch)) {
    return NextResponse.json({ error: "You can only manage employees in your own branches" }, { status: 403 })
  }
  return null
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser(request)
    if (auth.response) return auth.response
    const { id } = await params
    const denied = await branchCheck(id, auth.user)
    if (denied) return denied

    // Fetch the employee from Supabase
    const { data, error } = await supabase.from("employees").select("*").eq("id", id).single()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    return NextResponse.json(toEmployee(data))
  } catch (error) {
    console.error("Error fetching employee:", error)
    return NextResponse.json({ error: "Failed to fetch employee" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, "employees_edit")
    if (auth.response) return auth.response
    const { id } = await params
    const denied = await branchCheck(id, auth.user)
    if (denied) return denied
    const data = await request.json()

    // Validate required fields
    if (!data.name || !data.employeeCode || !data.branch || !data.jobTitle) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    if (!canAccessBranch(auth.user, data.branch)) {
      return NextResponse.json({ error: "You can only move employees to your own branches" }, { status: 403 })
    }

    // The yearly allowance: once it's tracked, balances are worked out from it
    // and the leave on record, so the days taken / remaining aren't typed in
    const allowance = parseAllowance(data.annualAllowance)
    if (allowance === "bad") {
      return NextResponse.json({ error: "The annual allowance must be a whole number of days from 0 to 366" }, { status: 400 })
    }
    const tracking = allowance !== undefined && (await allowanceColumnExists())
    const update: Record<string, unknown> = {
      name: data.name,
      employee_code: data.employeeCode,
      job_title: data.jobTitle,
      branch: data.branch,
      hours: data.hours, // Store hours directly in employees table
      email: data.email || null,
      phone: data.phone || null,
      status: data.status,
    }
    if (tracking) update.annual_allowance = allowance
    else {
      if (data.daysTaken !== undefined) update.days_taken = data.daysTaken
      if (data.daysRemaining !== undefined) update.days_remaining = data.daysRemaining
    }

    // Update the employee in Supabase
    const saved = await supabase.from("employees").update(update).eq("id", id).select().single()
    const { error } = saved
    let updatedEmployee = saved.data

    if (error) {
      throw error
    }
    // A changed allowance shows in their balance straight away
    if (tracking) {
      await applyBalanceCheck(undefined, { only: [id] })
      const fresh = await supabase.from("employees").select("*").eq("id", id).single()
      if (fresh.error) throw fresh.error
      updatedEmployee = fresh.data
    }
    if (!updatedEmployee) return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    // Their documents record follows a branch move, so it shows in the right place
    const { error: docError } = await supabase
      .from("documents")
      .update({ branch: updatedEmployee.branch, employee_name: updatedEmployee.name })
      .eq("employee_id", id)
    if (docError) console.error("Couldn't update the documents record with the employee:", docError)

    return NextResponse.json(toEmployee(updatedEmployee))
  } catch (error) {
    console.error("Error updating employee:", error)
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, "employees_delete")
    if (auth.response) return auth.response
    const { id } = await params
    const denied = await branchCheck(id, auth.user)
    if (denied) return denied

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
