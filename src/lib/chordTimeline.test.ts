import { describe, expect, it } from "vitest";

import {
  chordAt,
  chordIndexAt,
  chordsInWindow,
  isSilence,
  scrollOffset,
  timeFromClick,
  timeFromDrag,
  uniqueChords,
  chordPulse,
} from "./chordTimeline";
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

describe("timeFromDrag", () => {
  it("arrastar para a esquerda avança a música", () => {
    expect(timeFromDrag(10, -90, 90)).toBe(11);
  });

  it("arrastar para a direita volta", () => {
    expect(timeFromDrag(10, 180, 90)).toBe(8);
  });

  it("não passa do começo da música", () => {
    expect(timeFromDrag(1, 900, 90)).toBe(0);
  });

  it("parte sempre do tempo inicial, não do acumulado", () => {
    // Dois movimentos a partir do mesmo início dão o mesmo resultado que um
    // salto direto: é o que impede o arrasto de realimentar a si mesmo.
    expect(timeFromDrag(30, -45, 90)).toBe(timeFromDrag(30, -45, 90));
    expect(timeFromDrag(30, -90, 90)).toBe(31);
  });
});

describe("timeFromClick", () => {
  it("clicar no marcador não muda nada", () => {
    expect(timeFromClick(20, 200, 200, 90)).toBe(20);
  });

  it("clicar à direita do marcador avança", () => {
    expect(timeFromClick(20, 290, 200, 90)).toBe(21);
  });

  it("clicar à esquerda volta, sem passar do começo", () => {
    expect(timeFromClick(20, 110, 200, 90)).toBe(19);
    expect(timeFromClick(0.5, 0, 200, 90)).toBe(0);
  });
});

describe("uniqueChords", () => {
  const sequence = [
    chord("Am", 0, 2),
    chord("N", 2, 3),
    chord("C", 3, 5),
    chord("Am", 5, 7),
    chord("G", 7, 9),
    chord("C", 9, 11),
  ];

  it("lista cada acorde uma vez, na ordem de aparição", () => {
    expect(uniqueChords(sequence).map((entry) => entry.label)).toEqual(["Am", "C", "G"]);
  });

  it("conta quantas vezes cada um aparece", () => {
    const counts = Object.fromEntries(
      uniqueChords(sequence).map((entry) => [entry.label, entry.occurrences]),
    );
    expect(counts).toEqual({ Am: 2, C: 2, G: 1 });
  });

  it("guarda o instante da primeira aparição, não da última", () => {
    const [first] = uniqueChords(sequence);
    expect(first?.firstSeconds).toBe(0);
    expect(uniqueChords(sequence)[1]?.firstSeconds).toBe(3);
  });

  it("descarta os trechos sem acorde", () => {
    expect(uniqueChords(sequence).some((entry) => entry.label === "N")).toBe(false);
  });

  it("lida com música sem acorde nenhum", () => {
    expect(uniqueChords([])).toEqual([]);
    expect(uniqueChords([chord("N", 0, 5)])).toEqual([]);
  });
});

describe("chordPulse", () => {
  it("acende no início do acorde", () => {
    expect(chordPulse(10, 10)).toBe(1);
  });

  it("apaga ao longo do tempo", () => {
    const early = chordPulse(10.2, 10);
    const late = chordPulse(10.8, 10);
    expect(early).toBeGreaterThan(late);
    expect(late).toBeGreaterThan(0);
  });

  it("chega a zero depois do decaimento e lá permanece", () => {
    expect(chordPulse(12, 10)).toBe(0);
    expect(chordPulse(600, 10)).toBe(0);
  });

  it("não acende antes de o acorde começar", () => {
    // Acontece ao arrastar a música para trás.
    expect(chordPulse(9, 10)).toBe(0);
  });

  it("fica apagado em silêncio", () => {
    expect(chordPulse(10, null)).toBe(0);
  });

  it("cai rápido no começo e alonga o rastro", () => {
    // A curva ao quadrado perde mais da metade na primeira metade do tempo.
    expect(chordPulse(10.55, 10, 1.1)).toBeLessThan(0.3);
  });
});
