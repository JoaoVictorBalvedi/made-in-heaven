/** Escalas e sua projeção no braço da guitarra. Puro, sem DOM.
 *
 * Uma escala é definida pelos intervalos em semitons a partir da tônica. Tudo o
 * mais — quais notas caem em quais casas, qual grau cada uma é — é consequência
 * disso e da afinação, então nada aqui precisa ser tabelado à mão.
 */

export const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

/** Afinação padrão, da sexta corda para a primeira, em MIDI. */
export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64] as const;

export interface Scale {
  readonly id: string;
  readonly name: string;
  /** Semitons a partir da tônica. */
  readonly intervals: readonly number[];
  /** Nome de cada grau, na ordem dos intervalos. */
  readonly degrees: readonly string[];
}

export const SCALES: readonly Scale[] = [
  {
    id: "major",
    name: "Maior",
    intervals: [0, 2, 4, 5, 7, 9, 11],
    degrees: ["1", "2", "3", "4", "5", "6", "7"],
  },
  {
    id: "minor",
    name: "Menor natural",
    intervals: [0, 2, 3, 5, 7, 8, 10],
    degrees: ["1", "2", "♭3", "4", "5", "♭6", "♭7"],
  },
  {
    id: "pentatonic-minor",
    name: "Pentatônica menor",
    intervals: [0, 3, 5, 7, 10],
    degrees: ["1", "♭3", "4", "5", "♭7"],
  },
  {
    id: "pentatonic-major",
    name: "Pentatônica maior",
    intervals: [0, 2, 4, 7, 9],
    degrees: ["1", "2", "3", "5", "6"],
  },
  {
    id: "blues",
    name: "Blues",
    intervals: [0, 3, 5, 6, 7, 10],
    degrees: ["1", "♭3", "4", "♭5", "5", "♭7"],
  },
  {
    id: "dorian",
    name: "Dórica",
    intervals: [0, 2, 3, 5, 7, 9, 10],
    degrees: ["1", "2", "♭3", "4", "5", "6", "♭7"],
  },
  {
    id: "mixolydian",
    name: "Mixolídia",
    intervals: [0, 2, 4, 5, 7, 9, 10],
    degrees: ["1", "2", "3", "4", "5", "6", "♭7"],
  },
  {
    id: "lydian",
    name: "Lídia",
    intervals: [0, 2, 4, 6, 7, 9, 11],
    degrees: ["1", "2", "3", "♯4", "5", "6", "7"],
  },
  {
    id: "phrygian",
    name: "Frígia",
    intervals: [0, 1, 3, 5, 7, 8, 10],
    degrees: ["1", "♭2", "♭3", "4", "5", "♭6", "♭7"],
  },
  {
    id: "locrian",
    name: "Lócria",
    intervals: [0, 1, 3, 5, 6, 8, 10],
    degrees: ["1", "♭2", "♭3", "4", "♭5", "♭6", "♭7"],
  },
  {
    id: "harmonic-minor",
    name: "Menor harmônica",
    intervals: [0, 2, 3, 5, 7, 8, 11],
    degrees: ["1", "2", "♭3", "4", "5", "♭6", "7"],
  },
];

/** Uma casa do braço que pertence à escala. */
export interface ScaleNote {
  /** 0 é a sexta corda (mais grave). */
  readonly string: number;
  readonly fret: number;
  readonly noteName: string;
  readonly degree: string;
  readonly isRoot: boolean;
}

/** O índice de uma nota no ciclo cromático, a partir do nome. */
export function noteIndex(name: string): number {
  const found = NOTE_NAMES.indexOf(name as (typeof NOTE_NAMES)[number]);
  if (found === -1) throw new Error(`nota desconhecida: ${name}`);
  return found;
}

/** As alturas da escala, como classes de altura de 0 a 11. */
export function scalePitchClasses(rootIndex: number, scale: Scale): readonly number[] {
  return scale.intervals.map((interval) => (rootIndex + interval) % 12);
}

/** Todas as casas do braço que pertencem à escala, até o traste dado. */
export function scaleOnFretboard(
  rootIndex: number,
  scale: Scale,
  maxFret = 15,
  tuning: readonly number[] = STANDARD_TUNING,
): readonly ScaleNote[] {
  const byPitchClass = new Map<number, string>();
  scale.intervals.forEach((interval, index) => {
    byPitchClass.set((rootIndex + interval) % 12, scale.degrees[index] ?? "");
  });

  const notes: ScaleNote[] = [];
  tuning.forEach((openMidi, string) => {
    for (let fret = 0; fret <= maxFret; fret += 1) {
      const pitchClass = (openMidi + fret) % 12;
      const degree = byPitchClass.get(pitchClass);
      if (degree === undefined) continue;
      notes.push({
        string,
        fret,
        noteName: NOTE_NAMES[pitchClass] ?? "",
        degree,
        isRoot: pitchClass === rootIndex % 12,
      });
    }
  });
  return notes;
}

/** Os acordes que nascem de cada grau da escala, para escalas de sete notas.
 *
 * Empilhar terças sobre cada grau é o que liga a escala ao repertório: é assim
 * que se descobre por que uma música em Lá menor usa justamente Am, Dm e Em.
 */
export function diatonicChords(rootIndex: number, scale: Scale): readonly string[] {
  if (scale.intervals.length !== 7) return [];
  return scale.intervals.map((_, degree) => {
    const pick = (step: number) => {
      const interval = scale.intervals[(degree + step) % 7] ?? 0;
      // Graus que passam da oitava voltam ao começo da escala uma oitava acima.
      const octaves = Math.floor((degree + step) / 7) * 12;
      return interval + octaves;
    };
    const root = pick(0);
    const third = pick(2) - root;
    const fifth = pick(4) - root;
    const name = NOTE_NAMES[(rootIndex + root) % 12] ?? "";
    if (third === 3 && fifth === 6) return `${name}dim`;
    if (third === 3) return `${name}m`;
    if (third === 4 && fifth === 8) return `${name}aug`;
    return name;
  });
}

/** Uma escala que pertence a um tom, com o grau em que ela nasce. */
export interface ScaleInKey {
  readonly rootIndex: number;
  readonly rootName: string;
  readonly scale: Scale;
  /** Que papel ela cumpre dentro do tom. */
  readonly role: string;
}

/** Semitons dos sete graus da escala maior, a referência dos modos. */
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11] as const;

/** Os modos do maior e do menor, na ordem dos graus. */
const MODE_IDS = [
  "major", "dorian", "phrygian", "lydian", "mixolydian", "minor", "locrian",
] as const;
const MAJOR_DEGREE_NAMES = ["I", "ii", "iii", "IV", "V", "vi", "vii"] as const;

/** As escalas que servem sobre um tom.
 *
 * Todas contêm exatamente as mesmas notas — o que muda é onde está o repouso.
 * Vê-las lado a lado é o que mostra que dó maior e lá menor são o mesmo braço
 * com centros diferentes, e é isso que a tela quer ensinar.
 */
export function scalesInKey(rootIndex: number, quality: "major" | "minor"): readonly ScaleInKey[] {
  // O menor é o sexto grau do maior: reduz-se um caso ao outro.
  const majorRoot = quality === "major" ? rootIndex : (rootIndex + 3) % 12;
  const byId = new Map(SCALES.map((scale) => [scale.id, scale]));

  const modes: ScaleInKey[] = [];
  MODE_IDS.forEach((id, degree) => {
    const scale = byId.get(id);
    if (scale === undefined) return;
    const noteIndexOfDegree = (majorRoot + (MAJOR_STEPS[degree] ?? 0)) % 12;
    modes.push({
      rootIndex: noteIndexOfDegree,
      rootName: NOTE_NAMES[noteIndexOfDegree] ?? "",
      scale,
      role: `${MAJOR_DEGREE_NAMES[degree]} · ${scale.name.toLowerCase()}`,
    });
  });

  // As pentatônicas não são modos, mas são as escalas que de fato se usa para
  // improvisar num tom, então pertencem a esta lista.
  const pentatonics: ScaleInKey[] = [];
  const majorPenta = byId.get("pentatonic-major");
  const minorPenta = byId.get("pentatonic-minor");
  const relativeMinor = (majorRoot + 9) % 12;
  if (majorPenta !== undefined) {
    pentatonics.push({
      rootIndex: majorRoot,
      rootName: NOTE_NAMES[majorRoot] ?? "",
      scale: majorPenta,
      role: "pentatônica do tom maior",
    });
  }
  if (minorPenta !== undefined) {
    pentatonics.push({
      rootIndex: relativeMinor,
      rootName: NOTE_NAMES[relativeMinor] ?? "",
      scale: minorPenta,
      role: "pentatônica do relativo menor",
    });
  }
  const blues = byId.get("blues");
  if (blues !== undefined) {
    pentatonics.push({
      rootIndex: relativeMinor,
      rootName: NOTE_NAMES[relativeMinor] ?? "",
      scale: blues,
      role: "blues sobre o relativo menor",
    });
  }
  return [...modes, ...pentatonics];
}
