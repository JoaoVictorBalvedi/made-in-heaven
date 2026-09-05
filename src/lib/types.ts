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
