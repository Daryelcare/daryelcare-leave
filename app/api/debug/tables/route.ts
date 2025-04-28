import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    // Get all tables in the public schema
    const { data: tables, error: tablesError } = await supabase
      .from("pg_tables")
      .select("tablename")
      .eq("schemaname", "public")

    if (tablesError) {
      return NextResponse.json({ error: tablesError.message }, { status: 500 })
    }

    // Get information about leave_allocations table if it exists
    let leaveAllocationsInfo = null
    if (tables?.some((t) => t.tablename === "leave_allocations")) {
      const { data, error } = await supabase.from("leave_allocations").select("*").limit(1)

      if (!error) {
        leaveAllocationsInfo = {
          exists: true,
          sample: data,
        }
      } else {
        leaveAllocationsInfo = {
          exists: true,
          error: error.message,
        }
      }
    }

    // Get information about employees table if it exists
    let employeesInfo = null
    if (tables?.some((t) => t.tablename === "employees")) {
      const { data, error } = await supabase.from("employees").select("*").limit(1)

      if (!error) {
        employeesInfo = {
          exists: true,
          sample: data,
        }
      } else {
        employeesInfo = {
          exists: true,
          error: error.message,
        }
      }
    }

    return NextResponse.json({
      tables: tables?.map((t) => t.tablename),
      leaveAllocationsInfo,
      employeesInfo,
    })
  } catch (error) {
    console.error("Error in debug API:", error)
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
