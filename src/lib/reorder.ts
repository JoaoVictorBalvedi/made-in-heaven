/** Move um item de lugar numa lista, sem alterar a original. */
export function reorder<T>(items: readonly T[], from: number, to: number): readonly T[] {
  if (from === to) return items;
  if (from < 0 || from >= items.length) return items;
  const copy = [...items];
  const [moved] = copy.splice(from, 1);
  if (moved === undefined) return items;
  // Um destino além do fim encosta no fim, em vez de deixar um buraco.
  copy.splice(Math.max(0, Math.min(to, copy.length)), 0, moved);
  return copy;
}
