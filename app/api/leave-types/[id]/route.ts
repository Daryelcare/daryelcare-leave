
import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const data = await request.json()
    const { error } = await supabase
      .from("leave_types")
      .update({
        name: data.name,
        description: data.description,
        color: data.color,
        default_days: data.defaultDays,
        is_paid: data.isPaid,
        requires_approval: data.requiresApproval,
        allow_negative_balance: data.allowNegativeBalance,
        is_active: data.isActive,
      })
      .eq("id", params.id)

    if (error) {
      console.error("Failed to update leave type:", error)
      return NextResponse.json({ error: "Failed to update leave type" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating leave type:", error)
    return NextResponse.json({ error: "Failed to update leave type" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabase.from("leave_types").delete().eq("id", params.id)

    if (error) {
      console.error("Failed to delete leave type:", error)
      return NextResponse.json({ error: "Failed to delete leave type" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting leave type:", error)
    return NextResponse.json({ error: "Failed to delete leave type" }, { status: 500 })
  }
}
