import { NextResponse } from "next/server"
import { resetUserPassword } from "@/lib/auth"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const data = await request.json()
    const { password } = data

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 })
    }

    // Reset the user's password
    await resetUserPassword(id, password)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error resetting password:", error)
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 })
  }
}
