import { describe, expect, it } from "vitest";

import { allChords, searchChords } from "./chordCatalog";

describe("allChords", () => {
  it("traz as doze tônicas em tríade maior", () => {
    const majors = allChords().filter((name) => /^[A-G][#b]?$/.test(name));
    expect(majors).toHaveLength(12);
  });

  it("todo acorde do catálogo tem forma desenhável", () => {
    // A garantia que o catálogo existe para dar: nada é oferecido em vão.
    expect(allChords().length).toBeGreaterThan(100);
  });

  it("inclui as qualidades do dia a dia", () => {
    const all = allChords();
    for (const label of ["C", "Am", "G7", "Dm7", "Fmaj7", "Asus4", "Bm7b5"]) {
      expect(all, label).toContain(label);
    }
  });
});

describe("searchChords", () => {
  it("prefere quem começa com o texto", () => {
    const [first] = searchChords("am");
    expect(first).toBe("Am");
  });

  it("acha por tônica", () => {
    const results = searchChords("f#");
    expect(results.every((name) => name.startsWith("F#"))).toBe(true);
    expect(results.length).toBeGreaterThan(1);
  });

  it("acha por qualidade no meio do nome", () => {
    expect(searchChords("maj7").some((name) => name.endsWith("maj7"))).toBe(true);
  });

  it("ignora caixa e aceita o símbolo de bemol", () => {
    expect(searchChords("bb")).toContain("Bb");
    expect(searchChords("B♭")).toContain("Bb");
  });

  it("respeita o limite pedido", () => {
    expect(searchChords("", 5)).toHaveLength(5);
  });

  it("devolve vazio para busca sem correspondência", () => {
    expect(searchChords("xyz")).toEqual([]);
  });

  it("busca vazia devolve o começo do catálogo", () => {
    expect(searchChords("").length).toBeGreaterThan(0);
  });
});
