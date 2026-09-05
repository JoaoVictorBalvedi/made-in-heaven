import { describe, expect, it } from "vitest";

import { reorder } from "./reorder";

const list = ["a", "b", "c", "d"];

describe("reorder", () => {
  it("move para frente", () => {
    expect(reorder(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("move para trás", () => {
    expect(reorder(list, 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("mover para o próprio lugar não muda nada", () => {
    expect(reorder(list, 2, 2)).toBe(list);
  });

  it("destino além do fim encosta no fim", () => {
    expect(reorder(list, 0, 99)).toEqual(["b", "c", "d", "a"]);
  });

  it("origem inválida devolve a lista intacta", () => {
    expect(reorder(list, -1, 2)).toBe(list);
    expect(reorder(list, 9, 2)).toBe(list);
  });

  it("não altera a lista original", () => {
    const original = [...list];
    reorder(list, 0, 3);
    expect(list).toEqual(original);
  });

  it("preserva o tamanho e todos os itens", () => {
    const moved = reorder(list, 1, 3);
    expect(moved).toHaveLength(list.length);
    expect([...moved].sort()).toEqual([...list].sort());
  });
});
