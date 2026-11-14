/** "1 day", "3 days"; "1 person", "2 people" */
export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${Math.abs(count) === 1 ? one : many}`
}
