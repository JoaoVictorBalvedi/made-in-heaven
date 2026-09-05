/** Único ponto de contato com o mundo nativo.
 *
 * Todo `invoke` e toda chamada de plugin do Tauri passam por aqui. Componentes
 * Svelte falam com este módulo, nunca diretamente com a fronteira IPC — assim a
 * casca desktop pode mudar sem espalhar alteração pela interface.
 */

import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

import type { ChordAnalysis, Track } from "./types";

const AUDIO_EXTENSIONS = ["mp3", "flac", "wav", "m4a", "aac", "ogg", "opus"];

/** Abre o seletor de arquivos do sistema. Devolve `null` se o usuário cancelar. */
export async function pickAudioFile(): Promise<Track | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Áudio", extensions: AUDIO_EXTENSIONS }],
  });
  return selected === null ? null : toTrack(selected);
}

function toTrack(path: string): Track {
  return {
    path,
    title: fileTitle(path),
    mediaUrl: convertFileSrc(path),
  };
}

/** Nome do arquivo sem diretório nem extensão. */
function fileTitle(path: string): string {
  const fileName = path.split(/[\\/]/).pop() ?? path;
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/** Detecta os acordes de uma faixa. Resultado já analisado volta do cache. */
export function analyzeTrack(path: string): Promise<ChordAnalysis> {
  return invoke<ChordAnalysis>("analyze_track", { path });
}
