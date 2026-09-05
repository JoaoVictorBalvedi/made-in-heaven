import { describe, expect, it } from "vitest";

import { dominantHue, paletteFromPixels, rgbToHsl } from "./discPalette";

/** Monta um buffer RGBA a partir de cores repetidas. */
function pixels(...colors: Array<[number, number, number, number?]>): Uint8ClampedArray {
  const data = new Uint8ClampedArray(colors.length * 4);
  colors.forEach(([red, green, blue, alpha = 255], index) => {
    data.set([red, green, blue, alpha], index * 4);
  });
  return data;
}

function repeat(color: [number, number, number], times: number): Array<[number, number, number]> {
  return Array.from({ length: times }, () => color);
}

/** Matiz é circular e medido em graus: 359° e 1° são a mesma cor, e dois tons
 * a poucos graus de distância são indistinguíveis a olho. */
function expectHueNear(actual: number | undefined, expected: number, tolerance = 3): void {
  expect(actual).toBeDefined();
  const distance = Math.abs((((actual ?? 0) - expected + 540) % 360) - 180);
  expect(distance).toBeLessThanOrEqual(tolerance);
}

describe("rgbToHsl", () => {
  it("converte cores conhecidas", () => {
    expect(rgbToHsl(255, 0, 0)[0]).toBeCloseTo(0);
    expect(rgbToHsl(0, 255, 0)[0]).toBeCloseTo(120);
    expect(rgbToHsl(0, 0, 255)[0]).toBeCloseTo(240);
  });

  it("dá saturação zero para cinza", () => {
    expect(rgbToHsl(128, 128, 128)[1]).toBe(0);
  });
});

describe("dominantHue", () => {
  it("encontra a cor que domina", () => {
    const data = pixels(...repeat([200, 30, 30], 20), ...repeat([30, 30, 200], 3));
    const [hue] = dominantHue(data) ?? [];
    expectHueNear(hue, 0);
  });

  it("prefere cor viva a cinza mesmo em menor quantidade", () => {
    // Uma capa quase toda cinza com um detalhe vermelho: o disco fica vermelho.
    const data = pixels(...repeat([128, 128, 128], 30), ...repeat([220, 20, 20], 12));
    const [hue, saturation] = dominantHue(data) ?? [0, 0];
    expectHueNear(hue, 0);
    expect(saturation).toBeGreaterThan(0.5);
  });

  it("ignora pixels quase pretos e quase brancos", () => {
    // Uma capa só de extremos não tinge nada.
    expect(dominantHue(pixels(...repeat([4, 4, 4], 10), ...repeat([252, 252, 252], 10)))).toBeNull();
  });

  it("ignora pixel transparente", () => {
    expect(dominantHue(pixels([200, 30, 30, 10]))).toBeNull();
  });

  it("devolve null para buffer vazio", () => {
    expect(dominantHue(new Uint8ClampedArray())).toBeNull();
  });

  it("agrupa tons vizinhos no mesmo balde", () => {
    // Variações de um vermelho contam juntas, em vez de se dividirem.
    const data = pixels([200, 30, 30], [202, 32, 28], [198, 28, 33], ...repeat([30, 200, 30], 2));
    const [hue] = dominantHue(data) ?? [];
    expectHueNear(hue, 0);
  });

  it("não deixa uma fronteira de balde dividir a cor dominante", () => {
    // Tons de verde espalhados em torno de um limite de faixa contam juntos e
    // vencem um azul menos frequente, em vez de se fragmentarem.
    const green: Array<[number, number, number]> = [
      [40, 200, 60], [42, 198, 66], [38, 202, 55], [45, 205, 62], [36, 196, 58],
    ];
    const data = pixels(...green, ...repeat([40, 60, 200], 4));
    const [hue] = dominantHue(data) ?? [];
    expectHueNear(hue, 130, 20);
  });
});

describe("paletteFromPixels", () => {
  it("devolve null quando não há cor utilizável", () => {
    expect(paletteFromPixels(new Uint8ClampedArray())).toBeNull();
  });

  it("mantém o disco escuro mesmo com capa saturada", () => {
    const palette = paletteFromPixels(pixels(...repeat([255, 0, 0], 20)));
    // A luminosidade é fixa: o disco tinge, não vira plástico vermelho.
    expect(palette?.deep).toContain("5%");
    expect(palette?.sheen).toContain("24%");
  });

  it("limita a saturação para capa berrante não estourar", () => {
    const vivid = paletteFromPixels(pixels(...repeat([255, 0, 0], 20)));
    const muted = paletteFromPixels(pixels(...repeat([170, 110, 110], 20)));
    expect(vivid).not.toBeNull();
    expect(muted).not.toBeNull();
    // Teto em 0.55 de saturação: 0.55 * 45 ≈ 25%.
    expect(vivid?.sheen).toContain("25%");
  });
});
