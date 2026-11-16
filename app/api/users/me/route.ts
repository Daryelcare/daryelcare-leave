import { NextResponse } from "next/server"
import { supabase } from "@/lib/db"
import { getRequestUser, requireUser } from "@/lib/server-auth"
import { mustChangePassword } from "@/lib/password-change"
import { recordVisit } from "@/lib/last-seen"

// GET /api/users/me: the signed-in person's profile (role and branches), for
// the browser, which can't read the locked users table itself. Someone who can
// sign in but has no profile yet gets a basic one (no admin rights, no
// branches), as signing in always did.
export async function GET(request: Request) {
  try {
    const header = request.headers.get("authorization") || ""
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : ""
    if (!token) return NextResponse.json({ error: "Not signed in" }, { status: 401 })
    const { data: who, error: authError } = await supabase.auth.getUser(token)
    const email = who?.user?.email
    if (authError || !email) return NextResponse.json({ error: "Not signed in" }, { status: 401 })

    const { data: found, error } = await supabase
      .from("users")
      .select("id, email, name, role, branches")
      .eq("email", email)
      .maybeSingle()
    if (error) throw error
    let profile = found
    if (!profile) {
      const { data: created, error: insertError } = await supabase
        .from("users")
        .insert({
          id: who.user.id,
          email,
          name: (who.user.user_metadata?.name as string | undefined) || email.split("@")[0],
          role: "normal",
          branches: [],
          created_at: new Date().toISOString(),
        })
        .select("id, email, name, role, branches")
        .single()
      if (insertError) throw insertError
      profile = created
    }
    // Opening the app counts as a visit ("Last visit" on Users & access)
    await recordVisit(email)
    // What they may do, for hiding what's turned off (the server enforces it anyway)
    const me = await getRequestUser(request)
    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role === "admin" ? "admin" : "normal",
      branches: profile.branches || [],
      permissions: me?.permissions ?? null,
      // Choose a new password before using the app (one-time change, or a new / reset account)
      mustChangePassword: await mustChangePassword(email),
    })
  } catch (error) {
    console.error("Error loading own profile:", error)
    return NextResponse.json({ error: "Couldn't load your account. Please try again." }, { status: 500 })
  }
}

// PUT /api/users/me { name }: anyone can change their own display name.
// Role and branches stay with administrators.
export async function PUT(request: Request) {
  try {
    const auth = await requireUser(request)
    if (auth.response) return auth.response
    const { name } = await request.json()
    const clean = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : ""
    if (clean.length < 2 || clean.length > 80) {
      return NextResponse.json({ error: "Give a name between 2 and 80 characters" }, { status: 400 })
    }
    const { error } = await supabase.from("users").update({ name: clean }).eq("id", auth.user.id)
    if (error) throw error
    return NextResponse.json({ name: clean })
  } catch (error) {
    console.error("Error updating own name:", error)
    return NextResponse.json({ error: "Couldn't save your name. Please try again." }, { status: 500 })
  }
}
