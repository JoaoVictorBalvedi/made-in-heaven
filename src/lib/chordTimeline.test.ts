import { describe, expect, it } from "vitest";

import { chordAt, chordIndexAt, chordsInWindow, isSilence, scrollOffset } from "./chordTimeline";
import type { TimedChord } from "./types";

function chord(label: string, startSeconds: number, endSeconds: number): TimedChord {
  return { label, sourceLabel: label, startSeconds, endSeconds, strength: 0.9 };
}

// Sequência com uma lacuna deliberada entre 6s e 8s: o modelo não é obrigado a
// cobrir a música inteira.
const chords: TimedChord[] = [
  chord("A", 0, 2),
  chord("Dmaj7", 2, 4),
  chord("Bm", 4, 6),
  chord("E", 8, 10),
];

describe("chordIndexAt", () => {
  it("encontra o acorde que soa", () => {
    expect(chordIndexAt(chords, 1)).toBe(0);
    expect(chordIndexAt(chords, 3)).toBe(1);
    expect(chordIndexAt(chords, 9.99)).toBe(3);
  });

  it("na fronteira exata vale o acorde que começa", () => {
    // Sem isto, o acorde anterior pisca de volta por um quadro na virada.
    expect(chordIndexAt(chords, 2)).toBe(1);
    expect(chordIndexAt(chords, 4)).toBe(2);
  });

  it("devolve -1 nas lacunas e fora da música", () => {
    expect(chordIndexAt(chords, 7)).toBe(-1);
    expect(chordIndexAt(chords, 10)).toBe(-1);
    expect(chordIndexAt(chords, 999)).toBe(-1);
    expect(chordIndexAt(chords, -1)).toBe(-1);
  });

  it("lida com sequência vazia", () => {
    expect(chordIndexAt([], 5)).toBe(-1);
  });

  it("funciona ao buscar para trás", () => {
    // Arrastar a barra não pode depender de o tempo só crescer.
    expect(chordIndexAt(chords, 9)).toBe(3);
    expect(chordIndexAt(chords, 1)).toBe(0);
  });

  it("concorda com uma varredura linear em toda a música", () => {
    for (let time = 0; time <= 11; time += 0.1) {
      const expected = chords.findIndex((c) => time >= c.startSeconds && time < c.endSeconds);
      expect(chordIndexAt(chords, time)).toBe(expected);
    }
  });
});

describe("chordAt", () => {
  it("devolve o acorde ou null", () => {
    expect(chordAt(chords, 3)?.label).toBe("Dmaj7");
    expect(chordAt(chords, 7)).toBeNull();
  });
});

describe("chordsInWindow", () => {
  it("inclui os acordes que cruzam a janela, não só os contidos nela", () => {
    // Um acorde longo que começa antes da janela precisa aparecer nela.
    expect(chordsInWindow(chords, 1, 5).map((c) => c.label)).toEqual(["A", "Dmaj7", "Bm"]);
  });

  it("exclui quem apenas encosta na borda", () => {
    expect(chordsInWindow(chords, 2, 4).map((c) => c.label)).toEqual(["Dmaj7"]);
  });

  it("devolve vazio para janela degenerada", () => {
    expect(chordsInWindow(chords, 5, 5)).toEqual([]);
    expect(chordsInWindow(chords, 5, 1)).toEqual([]);
  });
});

describe("scrollOffset", () => {
  it("desloca proporcionalmente ao tempo", () => {
    expect(scrollOffset(0, 100, 200)).toBe(200);
    expect(scrollOffset(1, 100, 200)).toBe(100);
    expect(scrollOffset(3, 100, 200)).toBe(-100);
  });

  it("trata tempo inutilizável como início", () => {
    // `currentTime` é NaN enquanto os metadados não carregaram.
    expect(scrollOffset(Number.NaN, 100, 200)).toBe(200);
    expect(scrollOffset(-5, 100, 200)).toBe(200);
  });
});

describe("isSilence", () => {
  it("trata ausência de acorde e nulo como silêncio", () => {
    expect(isSilence(null)).toBe(true);
    expect(isSilence(chord("N", 0, 1))).toBe(true);
    expect(isSilence(chord("Am", 0, 1))).toBe(false);
  });
});
