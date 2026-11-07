/** The longest waiting first, without touching the page it was given. */
export function oldestFirst<T>(items: readonly T[], since: (item: T) => string): T[] {
  const time = (item: T) => new Date(since(item)).getTime();
  return [...items].sort((a, b) => time(a) - time(b));
}

/** How many a page holds: "20+" when another page follows (home plan, H2). */
export function countOf(page: { items: readonly unknown[]; nextCursor: string | null }): string {
  const count = String(page.items.length);
  return page.nextCursor === null ? count : `${count}+`;
}

/** The line under the greeting, for whoever decides. */
export function waitingSummary(count: string): string {
  if (count === '0') return 'Nenhum pedido espera sua decisão';
  if (count === '1') return '1 pedido espera sua decisão';
  return `${count} pedidos esperam sua decisão`;
}
