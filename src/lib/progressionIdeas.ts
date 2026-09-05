/** Ajuda a montar progressões: padrões conhecidos e o que costuma vir depois.
 *
 * Tudo é expresso em graus, não em acordes fixos, e instanciado no tom pedido.
 * Assim um padrão vale para as doze tonalidades sem nenhuma tabela a mais, e a
 * mesma máquina serve para sugerir o próximo acorde.
 */

import { NOTE_NAMES, SCALES, noteIndex } from "./scales";

/** Semitons de cada grau da escala maior, a referência dos algarismos romanos. */
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11] as const;
const ROMAN_ORDER = ["i", "ii", "iii", "iv", "v", "vi", "vii"] as const;

/** Converte um grau em acorde, no tom dado.
 *
 * Maiúscula é maior, minúscula é menor, `°` é diminuto, e `b`/`#` na frente
 * alteram o grau — é a notação que qualquer livro de harmonia usa.
 */
export function romanToChord(roman: string, rootIndex: number): string {
  const match = /^([b#]?)([ivIV]+)(°|dim|\+|aug|7|maj7|m7)?$/.exec(roman.trim());
  if (match === null) throw new Error(`grau inválido: ${roman}`);
  const [, accidental = "", numeral = "", suffix = ""] = match;

  const degree = ROMAN_ORDER.indexOf(numeral.toLowerCase() as (typeof ROMAN_ORDER)[number]);
  if (degree === -1) throw new Error(`grau inválido: ${roman}`);

  const shift = accidental === "b" ? -1 : accidental === "#" ? 1 : 0;
  const semitones = ((MAJOR_STEPS[degree] ?? 0) + shift + rootIndex + 120) % 12;
  const name = NOTE_NAMES[semitones] ?? "";

  const isMinor = numeral === numeral.toLowerCase();
  if (suffix === "°" || suffix === "dim") return `${name}dim`;
  if (suffix === "+" || suffix === "aug") return `${name}aug`;
  if (suffix === "7") return `${name}7`;
  if (suffix === "maj7") return `${name}maj7`;
  if (suffix === "m7") return `${name}m7`;
  return isMinor ? `${name}m` : name;
}

export interface ProgressionPattern {
  readonly id: string;
  readonly name: string;
  /** Como soa, em uma palavra ou duas. */
  readonly mood: string;
  /** Onde se ouve isso, para dar referência a quem está aprendendo. */
  readonly note: string;
  readonly romans: readonly string[];
  /** Em que escala o padrão faz sentido, para sugerir a tônica certa. */
  readonly scaleId: "major" | "minor";
}

export const PATTERNS: readonly ProgressionPattern[] = [
  {
    id: "pop",
    name: "I – V – vi – IV",
    mood: "Alegre, aberta",
    note: "A volta que sustenta boa parte da música pop das últimas décadas.",
    romans: ["I", "V", "vi", "IV"],
    scaleId: "major",
  },
  {
    id: "sensitive",
    name: "vi – IV – I – V",
    mood: "Melancólica, mas luminosa",
    note: "Os mesmos quatro acordes começando pelo relativo menor: muda tudo.",
    romans: ["vi", "IV", "I", "V"],
    scaleId: "major",
  },
  {
    id: "doo-wop",
    name: "I – vi – IV – V",
    mood: "Nostálgica",
    note: "O som dos anos 50, e de quase toda balada desde então.",
    romans: ["I", "vi", "IV", "V"],
    scaleId: "major",
  },
  {
    id: "andalusian",
    name: "i – ♭VII – ♭VI – V",
    mood: "Descendente, tensa",
    note: "A cadência andaluza: o baixo desce de meio em meio tom até o dominante.",
    romans: ["i", "bVII", "bVI", "V"],
    scaleId: "minor",
  },
  {
    id: "minor-loop",
    name: "i – ♭VI – ♭III – ♭VII",
    mood: "Épica, cinematográfica",
    note: "Menor sem resolver: gira sem chegar, e por isso soa grande.",
    romans: ["i", "bVI", "bIII", "bVII"],
    scaleId: "minor",
  },
  {
    id: "sad",
    name: "i – iv – v",
    mood: "Triste, antiga",
    note: "Menor natural pura, sem o dominante maior. Soa modal, quase folclórica.",
    romans: ["i", "iv", "v"],
    scaleId: "minor",
  },
  {
    id: "jazz",
    name: "ii7 – V7 – Imaj7",
    mood: "Jazzística",
    note: "A cadência que organiza praticamente todo standard.",
    romans: ["iim7", "V7", "Imaj7"],
    scaleId: "major",
  },
  {
    id: "blues",
    name: "I7 – IV7 – V7",
    mood: "Blues",
    note: "Três acordes com sétima; a estrutura de doze compassos nasce daqui.",
    romans: ["I7", "IV7", "V7"],
    scaleId: "major",
  },
  {
    id: "canon",
    name: "I – V – vi – iii – IV – I – IV – V",
    mood: "Solene, inevitável",
    note: "A sequência do Cânone de Pachelbel, reciclada há três séculos.",
    romans: ["I", "V", "vi", "iii", "IV", "I", "IV", "V"],
    scaleId: "major",
  },
  {
    id: "mixolydian",
    name: "I – ♭VII – IV",
    mood: "Rock, ensolarada",
    note: "O ♭VII vem de fora do tom maior e tira o peso do dominante.",
    romans: ["I", "bVII", "IV"],
    scaleId: "major",
  },
  {
    id: "descending-bass",
    name: "I – V/vii – vi – I/v",
    mood: "Descendente, suave",
    note: "A harmonia quase não muda; quem desce é o baixo, passo a passo.",
    romans: ["I", "V", "vi", "iii"],
    scaleId: "major",
  },
  {
    id: "dramatic",
    name: "i – ♭VII – ♭VI – ♭VII",
    mood: "Dramática, cíclica",
    note: "Desce e volta sem resolver, criando tensão que não descarrega.",
    romans: ["i", "bVII", "bVI", "bVII"],
    scaleId: "minor",
  },
];

/** Os acordes de um padrão, no tom pedido. */
export function patternChords(pattern: ProgressionPattern, rootIndex: number): readonly string[] {
  return pattern.romans.map((roman) => romanToChord(roman, rootIndex));
}

export interface DetectedKey {
  readonly rootIndex: number;
  readonly scaleId: "major" | "minor";
  /** Quantos dos acordes usados pertencem a este tom. */
  readonly matches: number;
}

/** Reduz um acorde à sua tríade, para comparar com o campo harmônico. */
function triadOf(label: string): string | null {
  const match = /^([A-G][#b]?)(.*)$/.exec(label);
  if (match === null) return null;
  const [, root = "", quality = ""] = match;
  if (quality.startsWith("dim") || quality.startsWith("m7b5")) return `${root}dim`;
  if (quality.startsWith("aug")) return `${root}aug`;
  if (quality.startsWith("maj")) return root;
  if (quality.startsWith("m")) return `${root}m`;
  return root;
}

/** O tom que melhor explica os acordes escolhidos até agora.
 *
 * Não é análise harmônica séria: é a pergunta prática "de que tonalidade estes
 * acordes são?", respondida contando quantos cabem em cada campo harmônico.
 */
export function detectKey(labels: readonly string[]): DetectedKey | null {
  if (labels.length === 0) return null;
  const triads = labels.map(triadOf).filter((value): value is string => value !== null);
  if (triads.length === 0) return null;

  const major = SCALES.find((entry) => entry.id === "major");
  const minor = SCALES.find((entry) => entry.id === "minor");
  if (major === undefined || minor === undefined) return null;

  let best: DetectedKey | null = null;
  for (const [scaleId, scale] of [["major", major], ["minor", minor]] as const) {
    for (let rootIndex = 0; rootIndex < 12; rootIndex += 1) {
      const field = new Set(fieldOf(rootIndex, scaleId));
      const matches = triads.filter((triad) => field.has(triad)).length;
      if (matches === 0) continue;
      // Empate resolve a favor de quem tem o primeiro acorde como tônica: é
      // quase sempre ele que soa como repouso.
      const tonic = fieldOf(rootIndex, scaleId)[0];
      const anchored = triads[0] === tonic;
      const bestAnchored = best !== null && fieldOf(best.rootIndex, best.scaleId)[0] === triads[0];
      if (
        best === null ||
        matches > best.matches ||
        (matches === best.matches && anchored && !bestAnchored)
      ) {
        best = { rootIndex, scaleId, matches };
      }
    }
  }
  return best;
}

/** As tríades do campo harmônico de um tom. */
function fieldOf(rootIndex: number, scaleId: "major" | "minor"): readonly string[] {
  const romans =
    scaleId === "major"
      ? ["I", "ii", "iii", "IV", "V", "vi", "vii°"]
      : ["i", "ii°", "bIII", "iv", "v", "bVI", "bVII"];
  return romans.map((roman) => romanToChord(roman, rootIndex));
}

/** Para onde cada grau costuma caminhar, do mais provável ao menos. */
const MOTION: Record<"major" | "minor", readonly (readonly number[])[]> = {
  //        I        ii       iii      IV       V        vi       vii°
  major: [[3, 4, 5, 1], [4, 6], [5, 3], [4, 0, 1], [0, 5], [3, 1, 4], [0]],
  //        i        ii°      III      iv       v        VI       VII
  minor: [[3, 5, 6, 4], [4, 6], [5, 6], [0, 6, 4], [0, 5], [6, 3, 2], [0, 2]],
};

export interface Suggestion {
  readonly label: string;
  /** O grau, em algarismo romano, para quem quiser entender o porquê. */
  readonly roman: string;
  /** Por que este acorde faz sentido agora. */
  readonly reason: string;
}

const REASONS: Record<"major" | "minor", readonly string[]> = {
  major: [
    "volta ao repouso",
    "prepara o dominante",
    "leva ao relativo menor",
    "abre, sem tensão",
    "pede a tônica",
    "o relativo menor: mesma casa, outra luz",
    "tensão máxima, quer resolver",
  ],
  minor: [
    "volta ao repouso",
    "instável, empurra adiante",
    "o relativo maior: alívio",
    "escurece sem sair do lugar",
    "cadência antiga, modal",
    "amplo, cinematográfico",
    "desce em direção à tônica",
  ],
};

/** O que costuma vir depois dos acordes já escolhidos.
 *
 * Sem nada escolhido ainda, não há o que sugerir: qualquer acorde serve de
 * começo, e fingir preferência ali seria arbitrário. Um tom pode ser imposto
 * de fora, para quem quer escrever numa tonalidade que a progressão ainda não
 * deixou clara.
 */
export function suggestNext(
  labels: readonly string[],
  override: Pick<DetectedKey, "rootIndex" | "scaleId"> | null = null,
): readonly Suggestion[] {
  const key = override === null ? detectKey(labels) : { ...override, matches: 0 };
  if (key === null) return [];

  const field = fieldOf(key.rootIndex, key.scaleId);
  const romans =
    key.scaleId === "major"
      ? ["I", "ii", "iii", "IV", "V", "vi", "vii°"]
      : ["i", "ii°", "♭III", "iv", "v", "♭VI", "♭VII"];

  const last = labels[labels.length - 1];
  const lastTriad = last === undefined ? null : triadOf(last);
  const currentDegree = lastTriad === null ? -1 : field.indexOf(lastTriad);

  // O último acorde não pertence ao tom: em vez de adivinhar, oferece o campo
  // inteiro, que é informação honesta.
  const order =
    currentDegree === -1
      ? [0, 3, 4, 5, 1, 2, 6]
      : [...(MOTION[key.scaleId][currentDegree] ?? []), ...[0, 3, 4, 5, 1, 2, 6]];

  const seen = new Set<number>();
  const suggestions: Suggestion[] = [];
  for (const degree of order) {
    if (seen.has(degree) || degree === currentDegree) continue;
    seen.add(degree);
    const label = field[degree];
    if (label === undefined) continue;
    suggestions.push({
      label,
      roman: romans[degree] ?? "",
      reason: REASONS[key.scaleId][degree] ?? "",
    });
  }
  return suggestions.slice(0, 5);
}

/** O nome do tom detectado, para mostrar na tela. */
export function keyName(key: DetectedKey): string {
  const name = NOTE_NAMES[key.rootIndex % 12] ?? "";
  return `${name} ${key.scaleId === "major" ? "maior" : "menor"}`;
}

export { noteIndex };
