import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { signUpUserWithProfile } from "@/lib/auth"

export async function GET() {
  try {
    // Execute the query
    const { data, error } = await supabase.from("users").select("*")

    if (error) {
      throw error
    }

    // Transform the data to match our frontend types
    const users = data.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      role: user.role,
      branches: user.branches,
      createdAt: user.created_at,
    }))

    return NextResponse.json(users)
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Validate required fields
    if (!data.email || !data.role || !data.password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Basic email validation before proceeding
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(data.email)) {
      return NextResponse.json(
        { error: `Email address "${data.email}" is invalid. Please use a valid email format.` },
        { status: 400 },
      )
    }

    // Check if user already exists in the users table
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("email", data.email)
      .maybeSingle()

    if (checkError) {
      console.error("Error checking for existing user:", checkError.message)
      return NextResponse.json({ error: "Error checking for existing user" }, { status: 500 })
    }

    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 })
    }

    // Create user in both Auth and users table
    try {
      const user = await signUpUserWithProfile(
        data.email,
        data.password,
        data.name || "",
        data.role,
        data.branches || [],
      )

      if (!user) {
        return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
      }

      // Transform to match frontend types
      const transformedUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        branches: user.branches,
        createdAt: new Date().toISOString(),
      }

      return NextResponse.json(transformedUser, { status: 201 })
    } catch (error: any) {
      // Check for common Supabase Auth errors
      if (error.message && error.message.includes("User already registered")) {
        return NextResponse.json({ error: "User with this email already exists in authentication" }, { status: 400 })
      }

      if (error.message && error.message.includes("invalid")) {
        return NextResponse.json(
          { error: error.message || "Invalid email address. Please use a different email." },
          { status: 400 },
        )
      }

      return NextResponse.json({ error: error.message || "Failed to create user" }, { status: 500 })
    }
  } catch (error: any) {
    console.error("Error creating user:", error)
    return NextResponse.json({ error: error.message || "Failed to create user" }, { status: 500 })
  }
}
