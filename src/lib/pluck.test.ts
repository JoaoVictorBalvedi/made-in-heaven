import { describe, expect, it } from "vitest";

import { karplusStrong, midiToFrequency, periodFor } from "./pluck";

/** Fonte determinística, para a onda ser sempre a mesma no teste. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function rms(samples: Float32Array, from: number, to: number): number {
  let total = 0;
  for (let index = from; index < to; index += 1) total += (samples[index] ?? 0) ** 2;
  return Math.sqrt(total / Math.max(1, to - from));
}

describe("midiToFrequency", () => {
  it("ancora no lá de 440 Hz", () => {
    expect(midiToFrequency(69)).toBeCloseTo(440);
  });

  it("uma oitava dobra a frequência", () => {
    expect(midiToFrequency(81)).toBeCloseTo(880);
    expect(midiToFrequency(57)).toBeCloseTo(220);
  });

  it("dá as frequências das cordas soltas da guitarra", () => {
    // Mi grave e mi agudo, as pontas da afinação padrão.
    expect(midiToFrequency(40)).toBeCloseTo(82.41, 1);
    expect(midiToFrequency(64)).toBeCloseTo(329.63, 1);
  });
});

describe("periodFor", () => {
  it("nota mais aguda tem período mais curto", () => {
    expect(periodFor(880, 44100)).toBeLessThan(periodFor(440, 44100));
  });

  it("nunca fica abaixo de duas amostras", () => {
    // Uma frequência absurda não pode produzir um anel degenerado.
    expect(periodFor(1e9, 44100)).toBe(2);
  });
});

describe("karplusStrong", () => {
  const options = { sampleRate: 8000, seconds: 0.5, random: seeded(7) };

  it("devolve exatamente a duração pedida", () => {
    expect(karplusStrong(220, options)).toHaveLength(4000);
  });

  it("toda amostra é finita e dentro da faixa", () => {
    const wave = karplusStrong(220, options);
    for (const sample of wave) {
      expect(Number.isFinite(sample)).toBe(true);
      expect(Math.abs(sample)).toBeLessThanOrEqual(1);
    }
  });

  it("a energia decai ao longo da nota", () => {
    const wave = karplusStrong(220, options);
    const quarter = Math.floor(wave.length / 4);
    expect(rms(wave, 0, quarter)).toBeGreaterThan(rms(wave, wave.length - quarter, wave.length));
  });

  it("termina em silêncio, sem estalo", () => {
    const wave = karplusStrong(220, options);
    expect(Math.abs(wave[wave.length - 1] ?? 1)).toBeLessThan(0.001);
  });

  it("decaimento menor encurta o som", () => {
    const longer = karplusStrong(220, { ...options, decay: 0.999, random: seeded(7) });
    const shorter = karplusStrong(220, { ...options, decay: 0.9, random: seeded(7) });
    const tail = Math.floor(longer.length / 2);
    expect(rms(longer, tail, longer.length)).toBeGreaterThan(rms(shorter, tail, shorter.length));
  });

  it("é determinística para a mesma fonte de aleatoriedade", () => {
    const first = karplusStrong(220, { ...options, random: seeded(3) });
    const second = karplusStrong(220, { ...options, random: seeded(3) });
    expect([...first]).toEqual([...second]);
  });

  it("duração zero não quebra", () => {
    expect(karplusStrong(220, { ...options, seconds: 0 })).toHaveLength(0);
  });
});
