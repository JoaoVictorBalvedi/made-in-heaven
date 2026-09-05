import { describe, expect, it } from "vitest";

import {
  SCALES,
  diatonicChords,
  noteIndex,
  scaleOnFretboard,
  scalePitchClasses,
  scalesInKey,
} from "./scales";

function scale(id: string) {
  const found = SCALES.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`escala ausente: ${id}`);
  return found;
}

describe("noteIndex", () => {
  it("mapeia o ciclo cromático", () => {
    expect(noteIndex("C")).toBe(0);
    expect(noteIndex("A")).toBe(9);
    expect(noteIndex("B")).toBe(11);
  });

  it("recusa nota inexistente", () => {
    expect(() => noteIndex("H")).toThrow();
  });
});

describe("SCALES", () => {
  it("toda escala tem um grau por intervalo", () => {
    for (const entry of SCALES) {
      expect(entry.degrees.length, entry.id).toBe(entry.intervals.length);
    }
  });

  it("todo intervalo cabe numa oitava e começa na tônica", () => {
    for (const entry of SCALES) {
      expect(entry.intervals[0], entry.id).toBe(0);
      expect(Math.max(...entry.intervals), entry.id).toBeLessThan(12);
    }
  });

  it("os intervalos são crescentes e sem repetição", () => {
    for (const entry of SCALES) {
      const sorted = [...entry.intervals].sort((left, right) => left - right);
      expect(entry.intervals, entry.id).toEqual(sorted);
      expect(new Set(entry.intervals).size, entry.id).toBe(entry.intervals.length);
    }
  });
});

describe("scalePitchClasses", () => {
  it("dó maior é a escala sem acidentes", () => {
    expect(scalePitchClasses(0, scale("major"))).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it("lá menor tem exatamente as mesmas notas de dó maior", () => {
    // Relativas: a mesma coleção, tônica diferente.
    const minor = [...scalePitchClasses(9, scale("minor"))].sort((a, b) => a - b);
    const major = [...scalePitchClasses(0, scale("major"))].sort((a, b) => a - b);
    expect(minor).toEqual(major);
  });

  it("dá a volta na oitava", () => {
    // Si maior: a segunda é dó sustenido, não dó — e ela vem depois de dar a
    // volta no ciclo, o que é justamente o que se está verificando aqui.
    const classes = scalePitchClasses(11, scale("major"));
    expect(classes[0]).toBe(11);
    expect(classes[1]).toBe(1);
    expect(classes).not.toContain(0);
    expect(new Set(classes).size).toBe(7);
  });
});

describe("scaleOnFretboard", () => {
  it("marca a corda solta quando ela pertence à escala", () => {
    // Em mi menor, as seis cordas soltas do violão pertencem à escala.
    const notes = scaleOnFretboard(noteIndex("E"), scale("minor"), 12);
    const openStrings = notes.filter((note) => note.fret === 0).map((note) => note.string);
    expect(openStrings).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("acha a tônica na casa certa da sexta corda", () => {
    // Sol na sexta corda é a terceira casa.
    const notes = scaleOnFretboard(noteIndex("G"), scale("major"), 12);
    const root = notes.find((note) => note.string === 0 && note.isRoot && note.fret > 0);
    expect(root?.fret).toBe(3);
  });

  it("a pentatônica menor tem cinco notas por oitava em cada corda", () => {
    const notes = scaleOnFretboard(noteIndex("A"), scale("pentatonic-minor"), 11);
    const onLowE = notes.filter((note) => note.string === 0);
    // Doze casas cobrem uma oitava: cinco notas, mais a repetição da tônica.
    expect(onLowE.length).toBe(5);
  });

  it("respeita o traste máximo", () => {
    const notes = scaleOnFretboard(0, scale("major"), 5);
    expect(Math.max(...notes.map((note) => note.fret))).toBeLessThanOrEqual(5);
  });

  it("dá nome e grau a cada nota", () => {
    const notes = scaleOnFretboard(noteIndex("C"), scale("major"), 3);
    const root = notes.find((note) => note.isRoot);
    expect(root?.noteName).toBe("C");
    expect(root?.degree).toBe("1");
  });
});

describe("diatonicChords", () => {
  it("dó maior gera os acordes do campo harmônico", () => {
    expect(diatonicChords(noteIndex("C"), scale("major"))).toEqual([
      "C", "Dm", "Em", "F", "G", "Am", "Bdim",
    ]);
  });

  it("lá menor gera o campo harmônico menor", () => {
    expect(diatonicChords(noteIndex("A"), scale("minor"))).toEqual([
      "Am", "Bdim", "C", "Dm", "Em", "F", "G",
    ]);
  });

  it("não inventa campo harmônico para escala de cinco notas", () => {
    // Empilhar terças sobre pentatônica não produz o que se espera de um campo.
    expect(diatonicChords(0, scale("pentatonic-minor"))).toEqual([]);
    expect(diatonicChords(0, scale("blues"))).toEqual([]);
  });
});

describe("scalesInKey", () => {
  it("dá os sete modos mais as pentatônicas", () => {
    const list = scalesInKey(noteIndex("C"), "major");
    expect(list.filter((entry) => entry.role.includes("·"))).toHaveLength(7);
    expect(list.length).toBeGreaterThan(7);
  });

  it("todos os modos de um tom têm exatamente as mesmas notas", () => {
    // É o ponto da tela: mesmo braço, centros diferentes.
    const list = scalesInKey(noteIndex("C"), "major").filter((entry) => entry.role.includes("·"));
    const sets = list.map((entry) =>
      [...scalePitchClasses(entry.rootIndex, entry.scale)].sort((a, b) => a - b).join(","),
    );
    expect(new Set(sets).size).toBe(1);
  });

  it("dó maior começa em dó e o sexto grau é lá menor", () => {
    const list = scalesInKey(noteIndex("C"), "major");
    expect(list[0]?.rootName).toBe("C");
    expect(list[5]?.rootName).toBe("A");
    expect(list[5]?.scale.id).toBe("minor");
  });

  it("lá menor devolve o mesmo conjunto que dó maior", () => {
    // Relativas: o mesmo material, pedido de dois jeitos.
    const fromMajor = scalesInKey(noteIndex("C"), "major").map((entry) => entry.rootName + entry.scale.id);
    const fromMinor = scalesInKey(noteIndex("A"), "minor").map((entry) => entry.rootName + entry.scale.id);
    expect(fromMinor).toEqual(fromMajor);
  });

  it("inclui a pentatônica menor do relativo", () => {
    const list = scalesInKey(noteIndex("C"), "major");
    const penta = list.find((entry) => entry.scale.id === "pentatonic-minor");
    expect(penta?.rootName).toBe("A");
  });

  it("nenhum modo fica de fora por escala ausente", () => {
    // Um identificador de modo sem escala correspondente sumiria em silêncio.
    for (const quality of ["major", "minor"] as const) {
      for (let root = 0; root < 12; root += 1) {
        const modes = scalesInKey(root, quality).filter((entry) => entry.role.includes("·"));
        expect(modes, `${root} ${quality}`).toHaveLength(7);
      }
    }
  });
});
