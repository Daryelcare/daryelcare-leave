// When the team calendar warns that too many people are off in one branch.
// The limit is either a number of people, or a share of the branch's staff
// (so a branch of 100 isn't flagged as often as a branch of 10).

export type WarnLimit = { value: number; unit: "people" | "percent" }
export const DEFAULT_LIMIT: WarnLimit = { value: 3, unit: "people" }

export function cleanLimit(raw: Partial<WarnLimit> | null | undefined): WarnLimit {
  const unit = raw?.unit === "percent" ? "percent" : "people"
  const max = unit === "percent" ? 100 : 50
  const min = unit === "percent" ? 1 : 2
  const value = Math.round(Number(raw?.value))
  return { unit, value: Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : unit === "percent" ? 10 : 3 }
}

/** How many people off in this branch count as too many */
export function limitFor(limit: WarnLimit, headcount: number | undefined): number {
  if (limit.unit === "people") return limit.value
  if (!headcount) return Infinity // no staff count yet: don't guess
  return Math.max(2, Math.ceil((limit.value / 100) * headcount))
}

/** Busy days per branch, for a short summary: "Haringey: 24 days (up to 6 off)" */
export function busySummary(busyByDay: Map<number, { branch: string; count: number }[]>) {
  const byBranch = new Map<string, { days: number[]; peak: number }>()
  for (const [day, list] of busyByDay) {
    for (const { branch, count } of list) {
      const b = byBranch.get(branch) ?? { days: [], peak: 0 }
      b.days.push(day)
      b.peak = Math.max(b.peak, count)
      byBranch.set(branch, b)
    }
  }
  return [...byBranch.entries()]
    .map(([branch, b]) => ({ branch, days: b.days.sort((x, y) => x - y), peak: b.peak }))
    .sort((a, b) => b.days.length - a.days.length || a.branch.localeCompare(b.branch))
}

/** "1–4, 9, 11–13": runs of consecutive days */
export function dayRuns(days: number[]): string {
  const out: string[] = []
  for (let i = 0; i < days.length; i++) {
    let j = i
    while (j + 1 < days.length && days[j + 1] === days[j] + 1) j++
    out.push(i === j ? `${days[i]}` : `${days[i]}–${days[j]}`)
    i = j
  }
  return out.join(", ")
}
