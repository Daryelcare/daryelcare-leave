import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/server-auth"
import { loadOrgPermissions, saveOrgPermissions } from "@/lib/permission-server"
import { columnsExist } from "@/lib/column-probe"
import { BUILT_IN_DEFAULTS, PERMISSION_KEYS, managerDefaults, type PermissionOverrides } from "@/lib/permissions"

export const dynamic = "force-dynamic"

// GET: what branch managers may do, organisation-wide (admins only)
export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response
  try {
    const { saved, stored } = await loadOrgPermissions()
    return NextResponse.json({
      stored,
      perPerson: await columnsExist("users", ["permission_overrides"]),
      settings: managerDefaults(saved),
      defaults: BUILT_IN_DEFAULTS,
    })
  } catch (error) {
    console.error("Error loading permissions:", error)
    return NextResponse.json({ error: "Couldn't load the permissions. Please try again." }, { status: 500 })
  }
}

// PUT { settings: { key: true/false, ... } }: change them (admins only)
export async function PUT(request: Request) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response
  try {
    const { stored } = await loadOrgPermissions()
    if (!stored) {
      return NextResponse.json(
        { error: "Permissions need a one-off database update before they can be changed." },
        { status: 409 },
      )
    }
    const body = await request.json().catch(() => ({}))
    const settings = body?.settings && typeof body.settings === "object" ? body.settings : null
    if (!settings) return NextResponse.json({ error: "Nothing to save" }, { status: 400 })
    // Store only what differs from the built-in defaults
    const diff: PermissionOverrides = {}
    for (const key of PERMISSION_KEYS) {
      if (typeof settings[key] === "boolean" && settings[key] !== BUILT_IN_DEFAULTS[key]) diff[key] = settings[key]
    }
    await saveOrgPermissions(diff, auth.user.email)
    console.log(`${auth.user.email} changed branch manager permissions: ${JSON.stringify(diff)}`)
    return NextResponse.json({ settings: managerDefaults(diff) })
  } catch (error) {
    console.error("Error saving permissions:", error)
    return NextResponse.json({ error: "Couldn't save the permissions. Please try again." }, { status: 500 })
  }
}
