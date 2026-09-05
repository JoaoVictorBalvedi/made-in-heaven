/** Traduz um rótulo de acorde numa forma tocável no braço da guitarra.
 *
 * As formas vêm do @tombatossals/chords-db (MIT), um banco curado por pessoas —
 * não geração automática. Isso importa: uma forma matematicamente correta e
 * impossível de pegar com quatro dedos não ajuda ninguém a estudar.
 *
 * Quando o acorde exato não existe no banco, a busca cai para uma forma mais
 * simples da mesma família em vez de não mostrar nada, e diz que fez isso.
 */

import guitarDatabase from "@tombatossals/chords-db/lib/guitar.json";

/** Uma posição no braço. `-1` é corda abafada, `0` é corda solta. */
export interface Voicing {
  readonly frets: readonly number[];
  readonly fingers: readonly number[];
  /** Primeira casa mostrada no diagrama; acima de 1 em formas com pestana alta. */
  readonly baseFret: number;
  readonly barres: readonly number[];
}

/** Quão fiel ao rótulo é a forma encontrada. */
export type VoicingFidelity =
  /** A forma toca exatamente o acorde pedido, baixo incluído. */
  | "exact"
  /** O baixo invertido não existe no banco; a forma toca o acorde fundamental. */
  | "bassDropped"
  /** A extensão não existe no banco; a forma toca uma versão mais simples. */
  | "simplified";

export interface VoicingResult {
  readonly voicings: readonly Voicing[];
  readonly fidelity: VoicingFidelity;
  /** O que foi de fato encontrado, para a interface poder dizer ao usuário. */
  readonly matchedLabel: string;
}

interface DatabaseChord {
  key: string;
  suffix: string;
  positions: Voicing[];
}

const CHORDS = guitarDatabase.chords as unknown as Record<string, DatabaseChord[]>;

/** O banco indexa por nome de grupo, que soletra sustenido por extenso. */
const KEY_GROUP: Record<string, string> = {
  "C": "C", "C#": "Csharp", "D": "D", "Eb": "Eb", "E": "E", "F": "F",
  "F#": "Fsharp", "G": "G", "Ab": "Ab", "A": "A", "Bb": "Bb", "B": "B",
};

/** O banco escolhe uma grafia por altura; a outra precisa ser traduzida. */
const ENHARMONIC: Record<string, string> = {
  "Db": "C#", "D#": "Eb", "Gb": "F#", "G#": "Ab", "A#": "Bb",
  "Cb": "B", "Fb": "E", "E#": "F", "B#": "C",
};

/** Grafias compactas do nosso worker para os sufixos do banco. */
const SUFFIX: Record<string, string> = {
  "": "major",
  "m": "minor",
  "maj7": "maj7", "maj9": "maj9", "maj11": "maj11", "maj13": "maj13",
  "7": "7", "9": "9", "11": "11", "13": "13",
  "6": "6", "69": "69", "add9": "add9",
  "m6": "m6", "m7": "m7", "m9": "m9", "m11": "m11", "m69": "m69",
  "m7b5": "m7b5", "mmaj7": "mmaj7", "madd9": "madd9",
  "dim": "dim", "dim7": "dim7", "aug": "aug", "aug7": "aug7",
  "sus2": "sus2", "sus4": "sus4", "7sus4": "7sus4",
  "7b5": "7b5", "7b9": "7b9", "7#9": "7#9", "9b5": "9b5",
  "maj7b5": "maj7b5", "maj7#5": "maj7#5",
};

/** A forma mais simples da mesma família, quando a extensão não existe. */
function simplify(quality: string): string {
  if (quality.startsWith("dim")) return "dim";
  if (quality.startsWith("aug")) return "aug";
  if (quality.startsWith("sus")) return quality.startsWith("sus2") ? "sus2" : "sus4";
  // "maj7" é maior; "m7" e "mmaj7" são menores. A ordem do teste importa.
  if (quality.startsWith("maj")) return "";
  if (quality.startsWith("m")) return "m";
  return "";
}

/** Normaliza uma nota para a grafia que o banco usa. */
function normalizeNote(note: string): string {
  return ENHARMONIC[note] ?? note;
}

/** Separa `Am7/G` em tônica, qualidade e baixo. */
export function parseLabel(label: string): { root: string; quality: string; bass: string | null } | null {
  const match = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(label);
  if (match === null) return null;
  const [, root = "", quality = "", bass] = match;
  return { root, quality, bass: bass ?? null };
}

function lookup(root: string, suffix: string): DatabaseChord | undefined {
  const group = KEY_GROUP[normalizeNote(root)];
  if (group === undefined) return undefined;
  return CHORDS[group]?.find((chord) => chord.suffix === suffix);
}

/** Formas para um rótulo, ou `null` se nem a tríade existir no banco. */
export function findVoicings(label: string): VoicingResult | null {
  const parsed = parseLabel(label);
  if (parsed === null) return null;
  const { root, quality, bass } = parsed;

  const suffix = SUFFIX[quality];
  const simplified = SUFFIX[simplify(quality)];

  // Com baixo invertido, o banco tem sufixos próprios: "/F#" e "m/G".
  if (bass !== null && suffix !== undefined) {
    const prefix = suffix === "minor" ? "m" : suffix === "major" ? "" : null;
    if (prefix !== null) {
      const bassSuffix = `${prefix}/${normalizeNote(bass)}`;
      const found = lookup(root, bassSuffix);
      if (found !== undefined) {
        return { voicings: found.positions, fidelity: "exact", matchedLabel: label };
      }
    }
  }

  const base = suffix === undefined ? undefined : lookup(root, suffix);
  if (base !== undefined) {
    return {
      voicings: base.positions,
      fidelity: bass === null ? "exact" : "bassDropped",
      matchedLabel: `${root}${quality}`,
    };
  }

  if (simplified !== undefined) {
    const fallback = lookup(root, simplified);
    if (fallback !== undefined) {
      return {
        voicings: fallback.positions,
        fidelity: "simplified",
        matchedLabel: `${root}${simplify(quality)}`,
      };
    }
  }
  return null;
}
