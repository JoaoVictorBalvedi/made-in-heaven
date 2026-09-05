/** Toca acordes com cordas sintetizadas, para ouvir uma progressão sendo montada.
 *
 * O contexto de áudio nasce apenas no primeiro toque: navegadores recusam criar
 * um antes de um gesto do usuário, e criá-lo à toa deixaria o aplicativo com um
 * contexto suspenso para sempre.
 */

import { karplusStrong, midiToFrequency } from "./pluck";

/** Atraso entre cordas vizinhas. É o que faz soar rasgado, não simultâneo. */
const STRUM_DELAY_SECONDS = 0.028;
const NOTE_SECONDS = 2.4;

export class ChordSynth {
  #context: AudioContext | null = null;
  #master: GainNode | null = null;

  #ensureContext(): AudioContext | null {
    if (this.#context === null) {
      try {
        this.#context = new AudioContext();
        this.#master = this.#context.createGain();
        this.#master.gain.value = 0.32;
        this.#master.connect(this.#context.destination);
      } catch {
        return null;
      }
    }
    // O contexto pode nascer suspenso quando a janela ainda não teve foco.
    if (this.#context.state === "suspended") void this.#context.resume();
    return this.#context;
  }

  /** Toca as notas em sequência rápida, como uma palhetada para baixo. */
  strum(midiNotes: readonly number[], direction: "down" | "up" = "down"): void {
    const context = this.#ensureContext();
    if (context === null || this.#master === null) return;

    const ordered = direction === "down" ? [...midiNotes] : [...midiNotes].reverse();
    const start = context.currentTime + 0.01;
    ordered.forEach((midi, index) => {
      this.#playNote(context, midi, start + index * STRUM_DELAY_SECONDS);
    });
  }

  #playNote(context: AudioContext, midi: number, when: number): void {
    if (!Number.isFinite(midi) || this.#master === null) return;
    const wave = karplusStrong(midiToFrequency(midi), {
      sampleRate: context.sampleRate,
      seconds: NOTE_SECONDS,
    });
    const buffer = context.createBuffer(1, wave.length, context.sampleRate);
    // Escrever direto no canal evita exigir um Float32Array respaldado por
    // ArrayBuffer, que é o que copyToChannel pede.
    buffer.getChannelData(0).set(wave);

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.#master);
    source.start(when);
  }

  dispose(): void {
    void this.#context?.close();
    this.#context = null;
    this.#master = null;
  }
}
