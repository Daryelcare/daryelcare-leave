// Supabase (PostgREST) returns at most 1000 rows per request, silently. Whole-
// table reads for summaries and trackers go through here, a page at a time.

const CHUNK = 1000

/**
 * Runs `page(from, to)` for consecutive ranges until a short page comes back,
 * and returns every row. `page` should build a fresh query each call and end
 * with `.range(from, to)` on a stable order (include a unique column).
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await page(from, from + CHUNK - 1)
    if (error) throw error
    const batch = data || []
    rows.push(...batch)
    if (batch.length < CHUNK) return rows
  }
}

/**
 * Runs `work` over `ids` in chunks, so long `.in()` lists stay inside URL
 * limits. Chunks run one after another.
 */
export async function inBatches<T>(ids: T[], work: (batch: T[]) => Promise<void>, size = 200): Promise<void> {
  for (let i = 0; i < ids.length; i += size) await work(ids.slice(i, i + size))
}
