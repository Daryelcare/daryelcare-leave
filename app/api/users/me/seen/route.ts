import { NextResponse } from "next/server"
import { requireUser } from "@/lib/server-auth"
import { recordVisit } from "@/lib/last-seen"

// POST /api/users/me/seen: the app was opened again (tab brought back), so
// "Last visit" on Users & access stays exact.
export async function POST(request: Request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response
  await recordVisit(auth.user.email)
  return NextResponse.json({ ok: true })
}
