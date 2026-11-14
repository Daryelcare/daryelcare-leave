// Rows per page for long lists (50, 100, 250 or all), as on CarerHR's lists.
// Pure functions, so they're easy to test.

export const PAGE_SIZES = [50, 100, 250, 0] as const // 0 = all
export type PageSize = (typeof PAGE_SIZES)[number]
export const toPageSize = (v: string | null): PageSize => {
  const n = Number(v)
  return (PAGE_SIZES as readonly number[]).includes(n) ? (n as PageSize) : 50
}

export function paginate<T>(rows: T[], page: number, size: PageSize) {
  if (size === 0) return { items: rows, page: 1, pages: 1, from: rows.length ? 1 : 0, to: rows.length }
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const p = Math.min(Math.max(1, page), pages)
  const start = (p - 1) * size
  return {
    items: rows.slice(start, start + size),
    page: p,
    pages,
    from: rows.length ? start + 1 : 0,
    to: Math.min(start + size, rows.length),
  }
}
