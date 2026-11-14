import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { requireAdmin, requireUser } from "@/lib/server-auth"
import { applyBalanceCheck } from "@/lib/balance-server"
import { buildLeaveYears } from "@/lib/leave-years"

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request)
    if (auth.response) return auth.response
    const activeOnly = new URL(request.url).searchParams.get("activeOnly") === "true"

    let query = supabase.from("leave_periods").select("*")
    if (activeOnly) query = query.eq("is_active", true)
    const { data, error } = await query.order("start_date", { ascending: false })
    if (error) throw error

    return NextResponse.json(
      (data || []).map((period) => ({
        id: period.id,
        startDate: period.start_date,
        endDate: period.end_date,
        isActive: period.is_active,
        createdAt: period.created_at,
      })),
    )
  } catch (error) {
    console.error("Error fetching leave periods:", error)
    return NextResponse.json({ error: "Couldn't load the leave periods. Please try again." }, { status: 500 })
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

// POST: start a new leave year (admins only). The database function makes it
// active and resets everyone to 28 days; balances are then worked out again
// from any leave already inside the new year, so starting a year late never
// wipes the leave people have already taken.
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request)
    if (auth.response) return auth.response
    const data = await request.json()
    if (!ISO.test(data.startDate || "") || !ISO.test(data.endDate || "") || data.endDate <= data.startDate) {
      return NextResponse.json({ error: "Give a start and an end date, with the end after the start" }, { status: 400 })
    }

    const { data: result, error } = await supabase.rpc("create_new_leave_period", {
      start_date: data.startDate,
      end_date: data.endDate,
    })
    if (error) throw error

    const [year] = buildLeaveYears(
      [{ startDate: data.startDate, endDate: data.endDate, isActive: true }],
      [],
      Date.now(),
    ).filter((y) => y.key === data.startDate)
    const recalculated = year ? await applyBalanceCheck(year) : null
    console.log(
      `${auth.user.email} started leave period ${data.startDate} – ${data.endDate}` +
        (recalculated ? `; ${recalculated.changed} balances set from leave already taken` : ""),
    )
    return NextResponse.json({ id: result, recalculated: recalculated?.changed ?? 0 }, { status: 201 })
  } catch (error) {
    console.error("Error creating leave period:", error)
    return NextResponse.json({ error: "Couldn't start the new leave period. Please try again." }, { status: 500 })
  }
}
