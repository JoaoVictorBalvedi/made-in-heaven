/** Único ponto de contato com o mundo nativo.
 *
 * Todo `invoke` e toda chamada de plugin do Tauri passam por aqui. Componentes
 * Svelte falam com este módulo, nunca diretamente com a fronteira IPC — assim a
 * casca desktop pode mudar sem espalhar alteração pela interface.
 */

import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

import type { ChordAnalysis, LibraryEntry, Track, YoutubeCandidate } from "./types";

const AUDIO_EXTENSIONS = ["mp3", "flac", "wav", "m4a", "aac", "ogg", "opus"];

/** Abre o seletor do sistema e guarda o escolhido no repertório.
 *
 * Devolve `null` se o usuário cancelar. O arquivo é copiado para a pasta de
 * dados: a partir daí o aplicativo não depende mais de onde ele estava.
 */
export async function pickAudioFile(): Promise<LibraryEntry | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Áudio", extensions: AUDIO_EXTENSIONS }],
  });
  if (selected === null) return null;
  return invoke<LibraryEntry>("library_add_file", { path: selected });
}

/** Uma entrada do repertório na forma que o reprodutor consome. */
export function trackFromEntry(entry: LibraryEntry): Track {
  return {
    path: entry.path,
    title: entry.title,
    mediaUrl: convertFileSrc(entry.path),
    coverUrl: entry.coverPath === null ? null : convertFileSrc(entry.coverPath),
  };
}

/** Todo o repertório guardado, do mais recente para o mais antigo. */
export function libraryList(): Promise<LibraryEntry[]> {
  return invoke<LibraryEntry[]>("library_list");
}

/** Completa título e capa do que ficou faltando no repertório.
 *
 * Não havendo nada a consertar, não toca na rede. Devolve o repertório inteiro.
 */
export function libraryRepair(): Promise<LibraryEntry[]> {
  return invoke<LibraryEntry[]>("library_repair");
}

/** Apaga uma música do repertório, junto da análise dela. */
export function libraryRemove(id: string): Promise<void> {
  return invoke<void>("library_remove", { id });
}

/** Detecta os acordes de uma faixa. Resultado já analisado volta do cache. */
export function analyzeTrack(path: string): Promise<ChordAnalysis> {
  return invoke<ChordAnalysis>("analyze_track", { path });
}

/** Busca no YouTube. Só metadados — nada é baixado nesta chamada. */
export function searchYoutube(query: string): Promise<YoutubeCandidate[]> {
  return invoke<YoutubeCandidate[]>("search_youtube", { query });
}

/** Traz um vídeo para o repertório. Se já estiver lá, nada é baixado. */
export function importYoutube(videoId: string): Promise<LibraryEntry> {
  return invoke<LibraryEntry>("import_youtube", { videoId });
}
