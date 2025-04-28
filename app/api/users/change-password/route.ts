import { NextResponse } from "next/server"
import { updatePassword } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { currentPassword, newPassword } = data

    if (!newPassword) {
      return NextResponse.json({ error: "New password is required" }, { status: 400 })
    }

    // Update the password using our auth function
    await updatePassword(newPassword)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error changing password:", error)
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 })
  }
}
