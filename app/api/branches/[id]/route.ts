import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// Update branch
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const { name } = await request.json()

    const { error } = await supabase.from("branches").update({ name }).eq("id", id)

    if (error) {
      console.error("Failed to update branch:", error)
      return NextResponse.json({ error: "Failed to update branch" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating branch:", error)
    return NextResponse.json({ error: "Failed to update branch" }, { status: 500 })
  }
}

// Delete branch
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id

    const { error } = await supabase.from("branches").delete().eq("id", id)

    if (error) {
      console.error("Failed to delete branch:", error)
      return NextResponse.json({ error: "Failed to delete branch" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting branch:", error)
    return NextResponse.json({ error: "Failed to delete branch" }, { status: 500 })
  }
}
