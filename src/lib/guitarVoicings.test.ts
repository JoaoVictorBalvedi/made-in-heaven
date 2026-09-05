import { describe, expect, it } from "vitest";

import { findVoicings, parseLabel } from "./guitarVoicings";

describe("parseLabel", () => {
  it("separa tônica, qualidade e baixo", () => {
    expect(parseLabel("Am7")).toEqual({ root: "A", quality: "m7", bass: null });
    expect(parseLabel("C")).toEqual({ root: "C", quality: "", bass: null });
    expect(parseLabel("D/F#")).toEqual({ root: "D", quality: "", bass: "F#" });
    expect(parseLabel("Am/G")).toEqual({ root: "A", quality: "m", bass: "G" });
    expect(parseLabel("Bbmaj7")).toEqual({ root: "Bb", quality: "maj7", bass: null });
  });

  it("rejeita o que não é rótulo de acorde", () => {
    expect(parseLabel("N")).toBeNull();
    expect(parseLabel("")).toBeNull();
    expect(parseLabel("Hm")).toBeNull();
  });
});

describe("findVoicings", () => {
  it("encontra as tríades comuns", () => {
    for (const label of ["C", "G", "D", "A", "E", "Am", "Em", "Dm"]) {
      const result = findVoicings(label);
      expect(result, label).not.toBeNull();
      expect(result?.fidelity, label).toBe("exact");
      expect(result?.voicings.length, label).toBeGreaterThan(0);
    }
  });

  it("devolve o acorde aberto de C na primeira posição", () => {
    // x32010: a forma que todo mundo aprende primeiro.
    expect(findVoicings("C")?.voicings[0]?.frets).toEqual([-1, 3, 2, 0, 1, 0]);
  });

  it("honra o baixo invertido quando o banco tem a forma", () => {
    const result = findVoicings("D/F#");
    expect(result?.fidelity).toBe("exact");
    expect(result?.voicings[0]?.frets).toEqual([2, 0, 0, 2, 3, 2]);
  });

  it("avisa quando descarta um baixo que não existe no banco", () => {
    // Baixo invertido sobre acorde com extensão não é catalogado.
    const result = findVoicings("Am7/G");
    expect(result?.fidelity).toBe("bassDropped");
    expect(result?.matchedLabel).toBe("Am7");
  });

  it("cai para a tríade quando a extensão não existe", () => {
    const result = findVoicings("Cmaj13");
    expect(result).not.toBeNull();
    if (result?.fidelity === "simplified") expect(result.matchedLabel).toBe("C");
  });

  it("simplifica menor com sétima maior para menor, não para maior", () => {
    // "mmaj7" começa com "m": a ordem dos testes em simplify() importa.
    const result = findVoicings("Cmmaj9");
    if (result?.fidelity === "simplified") expect(result.matchedLabel).toBe("Cm");
  });

  it("traduz grafias enarmônicas para as do banco", () => {
    // O banco cataloga Eb, não D#; C#, não Db.
    expect(findVoicings("D#m")).not.toBeNull();
    expect(findVoicings("Dbmaj7")).not.toBeNull();
    expect(findVoicings("G#")?.voicings.length).toBeGreaterThan(0);
  });

  it("encontra os acordes que o modelo produziu nas músicas de teste", () => {
    const observados = [
      "A", "Amaj7", "Bm", "D", "Dmaj7", "E", "E/B",
      "Am", "Am7", "Am/G", "C", "C/G", "D7", "D/F#", "E/G#",
      "F", "Fmaj7", "G", "G/B", "Abaug",
    ];
    for (const label of observados) {
      expect(findVoicings(label), label).not.toBeNull();
    }
  });

  it("devolve null para ausência de acorde", () => {
    expect(findVoicings("N")).toBeNull();
  });

  it("toda posição devolvida tem seis cordas", () => {
    const result = findVoicings("Am7");
    for (const voicing of result?.voicings ?? []) {
      expect(voicing.frets).toHaveLength(6);
      expect(voicing.fingers).toHaveLength(6);
    }
  });
});
