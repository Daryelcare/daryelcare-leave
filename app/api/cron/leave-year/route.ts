import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { runLeaveYearJob } from "@/lib/leave-year-job"

// Called every night by Vercel Cron (see vercel.json). Vercel sends the
// CRON_SECRET environment variable as a bearer token; anything else is refused.
export const dynamic = "force-dynamic"
export const maxDuration = 60

function authorised(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(request.headers.get("authorization") || "")
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "The nightly job isn't set up: CRON_SECRET is missing" }, { status: 503 })
  }
  if (!authorised(request)) return NextResponse.json({ error: "Not allowed" }, { status: 401 })
  const result = await runLeaveYearJob("nightly")
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
