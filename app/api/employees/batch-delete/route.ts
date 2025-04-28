import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(request: Request) {
  try {
    const { ids } = await request.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No employee IDs provided" }, { status: 400 })
    }

    // Delete employees in a single batch operation
    const { error, count } = await supabase.from("employees").delete().in("id", ids)

    if (error) {
      console.error("Error deleting employees:", error)
      return NextResponse.json({ error: `Failed to delete employees: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      deleted: count || ids.length,
      message: `Successfully deleted ${count || ids.length} employees`,
    })
  } catch (error) {
    console.error("Error in batch delete:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: `Failed to delete employees: ${errorMessage}` }, { status: 500 })
  }
}
