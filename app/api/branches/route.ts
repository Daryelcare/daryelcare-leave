import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// Get all branches
export async function GET() {
  try {
    const { data, error } = await supabase.from("branches").select("*").order("name")

    if (error) {
      console.error("Failed to fetch branches:", error)
      return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching branches:", error)
    return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 })
  }
}

// Create branch
export async function POST(request: Request) {
  try {
    const { name } = await request.json()

    const { error } = await supabase.from("branches").insert({ name })

    if (error) {
      console.error("Failed to create branch:", error)
      return NextResponse.json({ error: "Failed to create branch" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error creating branch:", error)
    return NextResponse.json({ error: "Failed to create branch" }, { status: 500 })
  }
}
