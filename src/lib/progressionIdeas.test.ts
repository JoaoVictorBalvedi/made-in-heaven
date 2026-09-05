import { describe, expect, it } from "vitest";

import { findVoicings } from "./guitarVoicings";
import {
  PATTERNS,
  detectKey,
  keyName,
  patternChords,
  romanToChord,
  suggestNext,
} from "./progressionIdeas";
import { noteIndex } from "./scales";

describe("romanToChord", () => {
  it("dá o campo harmônico maior de dó", () => {
    const romans = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
    expect(romans.map((roman) => romanToChord(roman, 0))).toEqual([
      "C", "Dm", "Em", "F", "G", "Am", "Bdim",
    ]);
  });

  it("maiúscula é maior e minúscula é menor", () => {
    expect(romanToChord("IV", 0)).toBe("F");
    expect(romanToChord("iv", 0)).toBe("Fm");
  });

  it("aceita alteração antes do grau", () => {
    // ♭VII de dó é si bemol, escrito A# na grafia do aplicativo.
    expect(romanToChord("bVII", 0)).toBe("A#");
    expect(romanToChord("bVI", 0)).toBe("G#");
  });

  it("aceita sufixos de sétima", () => {
    expect(romanToChord("V7", 0)).toBe("G7");
    expect(romanToChord("iim7", 0)).toBe("Dm7");
    expect(romanToChord("Imaj7", 0)).toBe("Cmaj7");
  });

  it("transpõe dando a volta na oitava", () => {
    // V de sol é ré; V de si é fá sustenido.
    expect(romanToChord("V", noteIndex("G"))).toBe("D");
    expect(romanToChord("V", noteIndex("B"))).toBe("F#");
  });

  it("recusa grau inválido", () => {
    expect(() => romanToChord("VIII", 0)).toThrow();
    expect(() => romanToChord("", 0)).toThrow();
  });
});

describe("PATTERNS", () => {
  it("todo padrão gera acordes desenháveis em qualquer tom", () => {
    // A garantia que importa: nenhuma sugestão leva a um acorde sem forma.
    for (const pattern of PATTERNS) {
      for (let root = 0; root < 12; root += 1) {
        for (const label of patternChords(pattern, root)) {
          expect(findVoicings(label), `${pattern.id} em ${root}: ${label}`).not.toBeNull();
        }
      }
    }
  });

  it("nenhum padrão está vazio e todos têm identificador único", () => {
    expect(PATTERNS.every((pattern) => pattern.romans.length > 0)).toBe(true);
    expect(new Set(PATTERNS.map((pattern) => pattern.id)).size).toBe(PATTERNS.length);
  });
});

describe("patternChords", () => {
  it("instancia I–V–vi–IV em dó", () => {
    const pop = PATTERNS.find((pattern) => pattern.id === "pop")!;
    expect(patternChords(pop, 0)).toEqual(["C", "G", "Am", "F"]);
  });

  it("instancia o mesmo padrão em sol", () => {
    const pop = PATTERNS.find((pattern) => pattern.id === "pop")!;
    expect(patternChords(pop, noteIndex("G"))).toEqual(["G", "D", "Em", "C"]);
  });

  it("instancia a cadência andaluza em lá menor", () => {
    const andalusian = PATTERNS.find((pattern) => pattern.id === "andalusian")!;
    expect(patternChords(andalusian, noteIndex("A"))).toEqual(["Am", "G", "F", "E"]);
  });
});

describe("detectKey", () => {
  it("reconhece dó maior", () => {
    const key = detectKey(["C", "G", "Am", "F"]);
    expect(key && keyName(key)).toBe("C maior");
  });

  it("reconhece lá menor pela ordem, não só pelas notas", () => {
    // Lá menor e dó maior têm o mesmo campo: o primeiro acorde desempata.
    expect(detectKey(["Am", "F", "C", "G"])).toMatchObject({ scaleId: "minor" });
    expect(detectKey(["C", "F", "Am", "G"])).toMatchObject({ scaleId: "major" });
  });

  it("ignora extensões ao comparar", () => {
    const key = detectKey(["Dm7", "G7", "Cmaj7"]);
    expect(key && keyName(key)).toBe("C maior");
  });

  it("devolve null sem acordes", () => {
    expect(detectKey([])).toBeNull();
  });

  it("aguenta acorde de fora do tom", () => {
    expect(detectKey(["C", "F", "G", "Ebdim"])).not.toBeNull();
  });
});

describe("suggestNext", () => {
  it("não sugere nada antes do primeiro acorde", () => {
    expect(suggestNext([])).toEqual([]);
  });

  it("depois do dominante, a tônica vem primeiro", () => {
    const [first] = suggestNext(["C", "F", "G"]);
    expect(first?.label).toBe("C");
    expect(first?.reason).toContain("repouso");
  });

  it("depois da tônica, oferece subdominante e dominante", () => {
    const labels = suggestNext(["C"]).map((entry) => entry.label);
    expect(labels).toContain("F");
    expect(labels).toContain("G");
  });

  it("nunca sugere repetir o acorde que acabou de tocar", () => {
    expect(suggestNext(["C", "G"]).some((entry) => entry.label === "G")).toBe(false);
  });

  it("toda sugestão traz grau e motivo", () => {
    for (const suggestion of suggestNext(["Am", "F"])) {
      expect(suggestion.roman).not.toBe("");
      expect(suggestion.reason).not.toBe("");
    }
  });

  it("toda sugestão é um acorde desenhável", () => {
    for (const seed of [["C"], ["Am", "G"], ["D", "A", "Bm"], ["Em"]]) {
      for (const suggestion of suggestNext(seed)) {
        expect(findVoicings(suggestion.label), suggestion.label).not.toBeNull();
      }
    }
  });

  it("devolve no máximo cinco ideias", () => {
    expect(suggestNext(["C"]).length).toBeLessThanOrEqual(5);
  });
});

describe("suggestNext com tom imposto", () => {
  it("segue o tom escolhido, não o deduzido", () => {
    const chords = ["C", "F"];
    const deduced = suggestNext(chords).map((entry) => entry.label);
    const forced = suggestNext(chords, { rootIndex: noteIndex("G"), scaleId: "major" })
      .map((entry) => entry.label);

    expect(forced).not.toEqual(deduced);
    // Ré e mi menor são de sol maior, e não do campo de dó que os acordes sugerem.
    expect(forced).toContain("D");
    expect(forced).toContain("Em");
    expect(deduced).not.toContain("D");
  });

  it("sugere mesmo sem nenhum acorde, quando o tom é escolhido", () => {
    const suggestions = suggestNext([], { rootIndex: 0, scaleId: "major" });
    expect(suggestions.map((entry) => entry.label)).toContain("C");
  });

  it("continua desenhável com tom imposto", () => {
    for (let root = 0; root < 12; root += 1) {
      for (const scaleId of ["major", "minor"] as const) {
        for (const suggestion of suggestNext(["C"], { rootIndex: root, scaleId })) {
          expect(findVoicings(suggestion.label), suggestion.label).not.toBeNull();
        }
      }
    }
  });
});
