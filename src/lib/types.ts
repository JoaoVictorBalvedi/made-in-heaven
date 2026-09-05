/** Contratos serializados que atravessam a fronteira IPC.
 *
 * Estes tipos espelham exatamente o que o Rust envia. Áudio bruto nunca cruza
 * essa fronteira — só metadados, caminhos e a sequência de acordes com tempos.
 */

/** Um acorde detectado, com o trecho da música em que soa. */
export interface TimedChord {
  /** Grafia compacta para exibição: `Am7`, `C/E`. `N` significa ausência de acorde. */
  readonly label: string;
  /** Grafia Harte original do modelo, preservada: `A:min7`. */
  readonly sourceLabel: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
  /** Confiança média do modelo na tríade, entre 0 e 1. */
  readonly strength: number;
}

/** Resultado completo da análise de uma música. */
export interface ChordAnalysis {
  readonly modelVersion: string;
  readonly dictionary: string;
  readonly durationSeconds: number;
  readonly chords: readonly TimedChord[];
  /** Problemas não fatais: a análise vale, mas algo merece atenção. */
  readonly warnings: readonly string[];
}

/** Uma música carregada no aplicativo. */
export interface Track {
  /** Caminho absoluto no disco. */
  readonly path: string;
  /** Nome exibido, derivado do arquivo enquanto não há metadado melhor. */
  readonly title: string;
  /** URL que o webview consegue carregar para reproduzir o arquivo. */
  readonly mediaUrl: string;
  /** Capa do álbum, quando existe. Vira o rótulo do disco. */
  readonly coverUrl: string | null;
}

/** Um resultado de busca do YouTube. Nada foi baixado ainda. */
export interface YoutubeCandidate {
  readonly id: string;
  readonly title: string;
  readonly channel: string;
  /** Ausente em transmissões ao vivo e afins. */
  readonly durationSeconds: number | null;
  readonly thumbnail: string | null;
}

/** Uma música guardada no repertório, dentro da pasta de dados do aplicativo. */
export interface LibraryEntry {
  /** SHA-256 do conteúdo. A mesma chave que indexa a análise de acordes. */
  readonly id: string;
  readonly title: string;
  readonly source: "file" | "youtube";
  readonly videoId: string | null;
  readonly path: string;
  readonly coverPath: string | null;
  /** Segundos desde a época. */
  readonly addedAt: number;
}

/** As telas do aplicativo. */
export type ViewId = "player" | "scales" | "progression";

/** Uma progressão salva pelo usuário. */
export interface SavedProgression {
  readonly id: string;
  readonly name: string;
  readonly chords: readonly string[];
  /** Segundos desde a época. */
  readonly savedAt: number;
}
