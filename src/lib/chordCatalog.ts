/** O catálogo de acordes que se pode escolher ao montar uma progressão.
 *
 * A lista é gerada cruzando tônicas com qualidades comuns e mantendo só o que
 * tem forma real no banco — assim a busca nunca oferece um acorde que a tela
 * seguinte não conseguiria desenhar.
 */

import { findVoicings } from "./guitarVoicings";

/** Grafias que o banco cataloga: sustenido em algumas, bemol em outras. */
const ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;

/** Da mais usada para a mais rara: é a ordem em que se aprende, e a ordem em
 * que faz sentido aparecer numa lista de sugestões. */
const QUALITIES = [
  "", "m", "7", "m7", "maj7", "sus4", "sus2", "6", "m6", "9", "add9", "dim", "m7b5", "aug",
] as const;

let catalogue: readonly string[] | null = null;

/** Todos os acordes escolhíveis, calculados uma vez. */
export function allChords(): readonly string[] {
  if (catalogue === null) {
    const names: string[] = [];
    for (const quality of QUALITIES) {
      for (const root of ROOTS) {
        const label = `${root}${quality}`;
        if (findVoicings(label) !== null) names.push(label);
      }
    }
    catalogue = names;
  }
  return catalogue;
}

/** Normaliza a escrita para comparar: caixa, e bemol escrito como "b". */
function fold(text: string): string {
  return text.trim().toLowerCase().replace(/♭/g, "b").replace(/♯/g, "#");
}

/** Os acordes que casam com o que foi digitado.
 *
 * Quem começa com o texto vem antes de quem apenas o contém: digitando "am" se
 * espera Am antes de Abmaj7.
 */
export function searchChords(query: string, limit = 24): readonly string[] {
  const needle = fold(query);
  const all = allChords();
  if (needle === "") return all.slice(0, limit);

  const starts: string[] = [];
  const contains: string[] = [];
  for (const name of all) {
    const folded = fold(name);
    if (folded.startsWith(needle)) starts.push(name);
    else if (folded.includes(needle)) contains.push(name);
  }
  return [...starts, ...contains].slice(0, limit);
}
