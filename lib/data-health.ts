// Data health: problems in the records that make the app's screens wrong or
// noisy, and the safe tidy-ups for them. Pure functions, so they're easy to test.

const SMALL = new Set(["of", "and", "the", "da", "de", "van", "von"])

/** "samsam hussein" → "Samsam Hussein"; "NIGERIA" → "Nigeria"; keeps O'Neil, Smith-Jones */
export function titleCase(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((word, i) =>
      i > 0 && SMALL.has(word) ? word : word.replace(/(^|[-'’])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase()),
    )
    .join(" ")
}

/** All lower case or all capitals (and long enough to be a real name) */
export const badlyCased = (text: string | null | undefined) =>
  !!text && /\p{L}{2}/u.test(text) && (text === text.toLowerCase() || text === text.toUpperCase())

/**
 * Values that only differ by case or spacing ("carer", "Carer", "CARER ").
 * Each group gets one spelling: the title-case one.
 */
export function caseVariants(values: (string | null | undefined)[]) {
  const groups = new Map<string, Map<string, number>>()
  for (const raw of values) {
    if (!raw || !raw.trim()) continue
    const key = raw.trim().replace(/\s+/g, " ").toLowerCase()
    const g = groups.get(key) ?? new Map<string, number>()
    g.set(raw, (g.get(raw) ?? 0) + 1)
    groups.set(key, g)
  }
  const out: { to: string; from: { value: string; count: number }[] }[] = []
  for (const [key, g] of groups) {
    const to = titleCase(key)
    const from = [...g.entries()].filter(([v]) => v !== to).map(([value, count]) => ({ value, count }))
    if (from.length) out.push({ to, from })
  }
  return out.sort((a, b) => b.from.reduce((t, f) => t + f.count, 0) - a.from.reduce((t, f) => t + f.count, 0))
}

/** Codes that look like placeholders: no digits, or words like temp / tenp / tbc */
export const placeholderCode = (code: string | null | undefined) =>
  !code || !code.trim() || /^(te[mn]+\d*p+\d*|temp\d*|tbc|tba|n\/?a|x+|-+)$/i.test(code.trim()) || !/\d/.test(code)

/** Names that appear more than once (possible duplicate people) */
export function duplicateNames<T extends { name: string }>(people: T[]) {
  const byName = new Map<string, T[]>()
  for (const p of people) {
    const key = p.name.trim().replace(/\s+/g, " ").toLowerCase()
    byName.set(key, [...(byName.get(key) ?? []), p])
  }
  return [...byName.values()].filter((g) => g.length > 1)
}

export type HealthCheck = {
  id: string
  title: string
  /** What it means and why it matters, in plain words */
  detail: string
  count: number
  severity: "fix" | "review" | "info"
  /** One-click tidy-up the server can do */
  action?: { id: string; label: string; confirm: string }
  /** Where to go to deal with it */
  link?: { href: string; label: string }
  /** A few examples */
  examples?: string[]
}
