// Leave-type colours, shared by the list, the request panel, the calendar and
// the dashboard so a type looks the same everywhere (as in CarerHR).
//
// Leave types are categories, not statuses, so they never use the status
// colours (red, amber, green), and they're muted rather than fluorescent. The
// common types keep a fixed colour; any other type hashes into a small pool so
// it's stable between pages. Every colour is dark enough for white text.

const BLUE = "#3567c8"
const CYAN = "#0e7490"
const VIOLET = "#7046c2"
const GREY = "#64748b"
const FUCHSIA = "#a3367f"
const SLATE = "#475569"
const TEAL_GREY = "#4b6475"
const POOL = [SLATE, TEAL_GREY] as const

// FNV-1a: cheap, stable, and spreads short labels evenly
function hash(label: string): number {
  let h = 2166136261
  for (let i = 0; i < label.length; i++) h = Math.imul(h ^ label.charCodeAt(i), 16777619)
  return h >>> 0
}

export function leaveTypeColour(type: string | null | undefined): string {
  const l = (type || "").toLowerCase().trim()
  if (l.includes("annual")) return BLUE
  if (l.includes("sick")) return CYAN
  if (l.includes("unpaid")) return GREY
  if (/matern|patern|parental|adoption/.test(l)) return VIOLET
  if (l.includes("working")) return FUCHSIA
  if (/compassion|bereave/.test(l)) return SLATE
  return POOL[hash(l) % POOL.length]
}
