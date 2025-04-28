import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    const { data, error } = await supabase.from("leave_types").select("*").order("name")

    if (error) {
      console.error("Failed to fetch leave types:", error)
      return NextResponse.json({ error: "Failed to fetch leave types" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching leave types:", error)
    return NextResponse.json({ error: "Failed to fetch leave types" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { error } = await supabase.from("leave_types").insert({
      name: data.name,
      description: data.description,
      color: data.color,
      default_days: data.defaultDays,
      is_paid: data.isPaid,
      requires_approval: data.requiresApproval,
      allow_negative_balance: data.allowNegativeBalance,
      is_active: data.isActive,
    })

    if (error) {
      console.error("Failed to create leave type:", error)
      return NextResponse.json({ error: "Failed to create leave type" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error creating leave type:", error)
    return NextResponse.json({ error: "Failed to create leave type" }, { status: 500 })
  }
}
