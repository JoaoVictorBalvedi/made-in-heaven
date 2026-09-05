/** Síntese de corda dedilhada por Karplus-Strong. Puro, sem Web Audio.
 *
 * Um ruído curto circulando por um atraso com filtro passa-baixa soa como corda
 * pinçada: as harmônicas agudas morrem antes das graves, que é exatamente o que
 * uma corda faz. Poucas linhas, e muito mais parecido com guitarra do que um
 * oscilador senoidal.
 */

/** Frequência de uma nota MIDI. Lá central (69) é 440 Hz por definição. */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Comprimento do atraso, em amostras. É ele que define a altura da nota. */
export function periodFor(frequency: number, sampleRate: number): number {
  // Menos de duas amostras não formam um ciclo; o piso evita divisão inútil.
  return Math.max(2, Math.round(sampleRate / frequency));
}

export interface PluckOptions {
  readonly sampleRate: number;
  readonly seconds: number;
  /** Quanto de energia sobrevive a cada volta. Perto de 1, soa mais longo. */
  readonly decay?: number;
  /** Fonte de aleatoriedade, injetável para o teste ser determinístico. */
  readonly random?: () => number;
}

/** A forma de onda de uma corda pinçada na frequência dada. */
export function karplusStrong(frequency: number, options: PluckOptions): Float32Array {
  const { sampleRate, seconds, decay = 0.996, random = Math.random } = options;
  const period = periodFor(frequency, sampleRate);
  const ring = new Float32Array(period);
  for (let index = 0; index < period; index += 1) {
    ring[index] = random() * 2 - 1;
  }

  const total = Math.max(0, Math.floor(sampleRate * seconds));
  const output = new Float32Array(total);
  // A cauda desaparece em rampa: cortar a onda no meio produz um estalo.
  const fadeSamples = Math.min(total, Math.floor(sampleRate * 0.05));

  for (let index = 0; index < total; index += 1) {
    const slot = index % period;
    const current = ring[slot] ?? 0;
    const next = ring[(slot + 1) % period] ?? 0;
    const remaining = total - index;
    const fade = remaining < fadeSamples ? remaining / fadeSamples : 1;
    output[index] = current * fade;
    // O filtro é a média de duas amostras vizinhas: passa-baixa mais simples
    // que existe, e é o que faz o agudo morrer antes do grave.
    ring[slot] = decay * 0.5 * (current + next);
  }
  return output;
}
