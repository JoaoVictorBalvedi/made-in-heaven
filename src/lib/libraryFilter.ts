/** Busca dentro do repertório já guardado. Puro, sem rede. */

import type { LibraryEntry } from "./types";

/** Normaliza para comparar ignorando caixa e acento. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** As entradas cujo título contém todos os termos da busca, em qualquer ordem. */
export function filterLibrary(
  entries: readonly LibraryEntry[],
  query: string,
): readonly LibraryEntry[] {
  const terms = fold(query).split(/\s+/).filter((term) => term !== "");
  if (terms.length === 0) return entries;
  return entries.filter((entry) => {
    const haystack = fold(entry.title);
    return terms.every((term) => haystack.includes(term));
  });
}
