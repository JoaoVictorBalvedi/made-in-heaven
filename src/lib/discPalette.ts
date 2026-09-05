/** Tira do rótulo as cores que tingem o disco.
 *
 * A matemática de cor fica separada da leitura da imagem para poder ser testada
 * sem DOM. Um vinil real não é preto puro: reflete a luz e o que está em volta,
 * e é isso que a capa passa a fazer aqui.
 */

export interface DiscPalette {
  /** O brilho que atravessa o disco. */
  readonly sheen: string;
  /** O fundo, nas bordas. */
  readonly deep: string;
  /** O tom dos sulcos. */
  readonly groove: string;
}

/** Faixas de matiz. Agrupar por matiz, e não por uma grade de RGB, evita que
 * uma cor dominante se divida entre baldes vizinhos ao cruzar uma fronteira e
 * perca para uma cor menos frequente que por acaso caiu inteira num balde. */
const HUE_BINS = 24;
const BIN_WIDTH = 360 / HUE_BINS;

/** Pixels quase pretos ou quase brancos não dizem nada sobre a cor da capa. */
const MIN_LUMA = 26;
const MAX_LUMA = 232;

/** Piso de peso para que cinza conte alguma coisa, sem dominar. */
const GREY_WEIGHT = 0.2;

interface Bin {
  weight: number;
  hue: number;
  saturation: number;
}

export function rgbToHsl(red: number, green: number, blue: number): [number, number, number] {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness];

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue: number;
  if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / delta + 2) / 6;
  else hue = ((r - g) / delta + 4) / 6;
  return [hue * 360, saturation, lightness];
}

/** O matiz dominante de um conjunto de pixels RGBA, e quão saturado ele é.
 *
 * O peso de cada pixel cresce com a saturação: numa capa quase toda cinza, o
 * pouco de cor que existe é justamente o que deve tingir o disco.
 */
export function dominantHue(data: Uint8ClampedArray): [number, number] | null {
  const bins = new Map<number, Bin>();

  for (let index = 0; index + 3 < data.length; index += 4) {
    const alpha = data[index + 3] ?? 0;
    if (alpha < 128) continue;
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    const luma = 0.299 * red + 0.587 * green + 0.114 * blue;
    if (luma < MIN_LUMA || luma > MAX_LUMA) continue;

    const [hue, saturation] = rgbToHsl(red, green, blue);
    const weight = GREY_WEIGHT + saturation;
    const key = Math.floor(hue / BIN_WIDTH) % HUE_BINS;
    const bin = bins.get(key) ?? { weight: 0, hue: 0, saturation: 0 };
    bin.weight += weight;
    bin.hue += hue * weight;
    bin.saturation += saturation * weight;
    bins.set(key, bin);
  }

  let best: Bin | null = null;
  for (const bin of bins.values()) {
    if (best === null || bin.weight > best.weight) best = bin;
  }
  if (best === null) return null;
  return [best.hue / best.weight, best.saturation / best.weight];
}

/** A paleta do disco a partir dos pixels do rótulo. */
export function paletteFromPixels(data: Uint8ClampedArray): DiscPalette | null {
  const dominant = dominantHue(data);
  if (dominant === null) return null;
  const [hue, saturation] = dominant;
  // Teto na saturação: o disco tinge, não vira plástico colorido.
  const tint = Math.min(saturation, 0.55);
  return {
    sheen: `hsl(${hue.toFixed(0)} ${(tint * 45).toFixed(0)}% 24%)`,
    deep: `hsl(${hue.toFixed(0)} ${(tint * 40).toFixed(0)}% 5%)`,
    groove: `hsl(${hue.toFixed(0)} ${(tint * 35).toFixed(0)}% 58%)`,
  };
}

/** A cor do disco quando não há capa de onde tirá-la. */
export const NEUTRAL_PALETTE: DiscPalette = {
  sheen: "#3a3a44",
  deep: "#08080a",
  groove: "#6a6a78",
};

/** Amostra pequena: 48×48 já dá a cor dominante e custa quase nada. */
const SAMPLE_SIZE = 48;

/** Lê a capa e devolve a paleta do disco, ou `null` se não der.
 *
 * Falha silenciosa é o comportamento certo: a imagem pode não carregar, ou o
 * canvas pode recusar a leitura de pixels. Nos dois casos o disco continua com
 * a cor padrão, que já é boa — nada disso merece um erro na tela.
 */
export async function loadDiscPalette(url: string): Promise<DiscPalette | null> {
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => reject(new Error("capa não carregou")), { once: true });
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) return null;
    context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    return paletteFromPixels(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data);
  } catch {
    return null;
  }
}
