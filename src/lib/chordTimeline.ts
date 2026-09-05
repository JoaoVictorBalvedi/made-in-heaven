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

/** O instante para onde arrastar leva, a partir de onde o arrasto começou.
 *
 * O cálculo parte do tempo inicial e do deslocamento em pixels, nunca do tempo
 * atual: usar o tempo atual realimentaria o próprio arrasto, já que mover a
 * faixa muda o que está sob o cursor.
 */
export function timeFromDrag(
  startTime: number,
  deltaX: number,
  pixelsPerSecond: number,
): number {
  // Arrastar a faixa para a esquerda avança a música, como empurrar a fita.
  return Math.max(0, startTime - deltaX / pixelsPerSecond);
}

/** O instante correspondente a um ponto da faixa, para um clique simples. */
export function timeFromClick(
  currentTime: number,
  x: number,
  playheadOffset: number,
  pixelsPerSecond: number,
): number {
  return Math.max(0, currentTime + (x - playheadOffset) / pixelsPerSecond);
}

/** Um acorde distinto da música, com quantas vezes aparece. */
export interface ChordSummary {
  readonly label: string;
  readonly occurrences: number;
  /** Segundo em que soa pela primeira vez. Serve para pular até ele. */
  readonly firstSeconds: number;
}

/** Os acordes distintos da música, na ordem em que aparecem pela primeira vez.
 *
 * Ordem de aparição, e não frequência: é assim que a pessoa encontra o acorde
 * que ouviu, e é a ordem em que ela vai precisar aprendê-los.
 */
export function uniqueChords(chords: readonly TimedChord[]): readonly ChordSummary[] {
  const seen = new Map<string, { occurrences: number; firstSeconds: number }>();
  for (const chord of chords) {
    if (isSilence(chord)) continue;
    const existing = seen.get(chord.label);
    if (existing === undefined) {
      seen.set(chord.label, { occurrences: 1, firstSeconds: chord.startSeconds });
    } else {
      existing.occurrences += 1;
    }
  }
  return [...seen].map(([label, data]) => ({ label, ...data }));
}

/** Quanto tempo leva o brilho de uma troca de acorde para se apagar. */
const PULSE_DECAY_SECONDS = 1.1;

/** A intensidade do brilho no instante dado, entre 0 e 1.
 *
 * Cada acorde novo acende e apaga. É a harmonia que faz o fundo respirar —
 * dado que o aplicativo já tem, e mais musical do que reagir a volume.
 */
export function chordPulse(
  currentTime: number,
  chordStart: number | null,
  decaySeconds: number = PULSE_DECAY_SECONDS,
): number {
  if (chordStart === null || decaySeconds <= 0) return 0;
  const elapsed = currentTime - chordStart;
  // Antes do acorde começar não há o que acender — acontece ao voltar a música.
  if (elapsed < 0 || elapsed >= decaySeconds) return 0;
  const remaining = 1 - elapsed / decaySeconds;
  // Ao quadrado: cai rápido no começo e alonga o rastro, como um som decaindo.
  return remaining * remaining;
}
