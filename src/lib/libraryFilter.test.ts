import { describe, expect, it } from "vitest";

import { filterLibrary } from "./libraryFilter";
import type { LibraryEntry } from "./types";

function entry(title: string): LibraryEntry {
  return {
    id: title,
    title,
    source: "file",
    videoId: null,
    path: `/${title}`,
    coverPath: null,
    addedAt: 0,
  };
}

const library = [
  entry("Don't Yuck My Yum"),
  entry("Águas de Março"),
  entry("Blue Deer Studio - Ao vivo"),
];

describe("filterLibrary", () => {
  it("devolve tudo quando a busca está vazia", () => {
    expect(filterLibrary(library, "")).toHaveLength(3);
    expect(filterLibrary(library, "   ")).toHaveLength(3);
  });

  it("ignora caixa", () => {
    expect(filterLibrary(library, "YUCK")).toHaveLength(1);
  });

  it("ignora acento nos dois lados", () => {
    // Digitar "aguas" precisa achar "Águas", e vice-versa.
    expect(filterLibrary(library, "aguas")).toHaveLength(1);
    expect(filterLibrary(library, "Águas")).toHaveLength(1);
  });

  it("aceita termos em qualquer ordem", () => {
    expect(filterLibrary(library, "studio blue")).toHaveLength(1);
  });

  it("exige todos os termos", () => {
    expect(filterLibrary(library, "blue março")).toHaveLength(0);
  });

  it("devolve vazio quando nada casa", () => {
    expect(filterLibrary(library, "inexistente")).toHaveLength(0);
  });
});
