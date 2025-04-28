import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const data = await request.json()
    const { branches } = data

    // Update the user's branches
    const { data: updatedUser, error } = await supabase
      .from("users")
      .update({ branches })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Transform to match frontend types
    const transformedUser = {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name || undefined,
      role: updatedUser.role,
      branches: updatedUser.branches,
      createdAt: updatedUser.created_at,
    }

    return NextResponse.json(transformedUser)
  } catch (error) {
    console.error("Error updating branches:", error)
    return NextResponse.json({ error: "Failed to update branches" }, { status: 500 })
  }
}
