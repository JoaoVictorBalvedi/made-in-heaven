/** Projeção da sequência de acordes sobre a linha do tempo.
 *
 * Puro e sem DOM: dado o instante da reprodução, decide o que está soando e
 * onde cada acorde deve ficar na faixa. É a lógica que precisa estar certa para
 * o acorde na tela corresponder ao que se ouve, então mora fora do componente.
 */

import type { TimedChord } from "./types";

/** Índice do acorde que soa no instante dado, ou -1 se nenhum soa.
 *
 * O intervalo é fechado no início e aberto no fim: na fronteira exata entre
 * dois acordes, quem vale é o que começa. Busca binária porque isto roda a cada
 * quadro.
 */
export function chordIndexAt(chords: readonly TimedChord[], time: number): number {
  let low = 0;
  let high = chords.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const chord = chords[middle];
    if (chord === undefined) break;
    if (time < chord.startSeconds) high = middle - 1;
    else if (time >= chord.endSeconds) low = middle + 1;
    else return middle;
  }
  return -1;
}

/** O acorde que soa agora, ou `null` em silêncio, antes do início ou após o fim. */
export function chordAt(chords: readonly TimedChord[], time: number): TimedChord | null {
  const index = chordIndexAt(chords, time);
  return index === -1 ? null : (chords[index] ?? null);
}

/** Os acordes que aparecem numa janela de tempo, incluindo os que a cruzam. */
export function chordsInWindow(
  chords: readonly TimedChord[],
  from: number,
  to: number,
): readonly TimedChord[] {
  if (to <= from) return [];
  return chords.filter((chord) => chord.endSeconds > from && chord.startSeconds < to);
}

/** Quantos pixels a faixa deve deslizar para a esquerda no instante dado.
 *
 * O marcador fica parado; quem se move é a música. `playheadOffset` é a
 * distância entre a borda esquerda e o marcador, em pixels.
 */
export function scrollOffset(
  time: number,
  pixelsPerSecond: number,
  playheadOffset: number,
): number {
  if (!Number.isFinite(time) || time < 0) return playheadOffset;
  return playheadOffset - time * pixelsPerSecond;
}

/** Um acorde deve ser exibido como texto ou como ausência de acorde? */
export function isSilence(chord: TimedChord | null): boolean {
  return chord === null || chord.label === "N";
}
