<script lang="ts">
  import { onDestroy } from "svelte";

  import ChordTimeline from "./lib/ChordTimeline.svelte";
  import { analyzeTrack, pickAudioFile } from "./lib/backend";
  import { AudioPlayer } from "./lib/audioPlayer";
  import { chordAt, isSilence } from "./lib/chordTimeline";
  import { formatTime } from "./lib/formatTime";
  import type { ChordAnalysis, Track } from "./lib/types";

  const player = new AudioPlayer();

  let track = $state<Track | null>(null);
  let currentTime = $state(0);
  let duration = $state(0);
  let playing = $state(false);
  let error = $state<string | null>(null);
  let loading = $state(false);
  let analysis = $state<ChordAnalysis | null>(null);
  let analyzing = $state(false);

  const currentChord = $derived(
    analysis === null ? null : chordAt(analysis.chords, currentTime),
  );

  const stopWatching = player.onTime((time) => {
    currentTime = time;
    playing = player.playing;
  });
  onDestroy(() => {
    stopWatching();
    player.destroy();
  });

  async function chooseFile() {
    error = null;
    try {
      const chosen = await pickAudioFile();
      if (chosen === null) return;
      loading = true;
      await player.load(chosen.mediaUrl);
      track = chosen;
      duration = player.duration;
      currentTime = 0;
      analysis = null;
      void analyze(chosen);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      track = null;
    } finally {
      loading = false;
    }
  }

  async function analyze(target: Track) {
    analyzing = true;
    try {
      const result = await analyzeTrack(target.path);
      // A faixa pode ter sido trocada enquanto a análise rodava.
      if (track?.path === target.path) analysis = result;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      analyzing = false;
    }
  }

  async function toggle() {
    error = null;
    try {
      if (player.playing) player.pause();
      else await player.play();
      playing = player.playing;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  function scrub(event: Event) {
    player.seek(Number((event.currentTarget as HTMLInputElement).value));
  }
</script>

<main>
  <header>
    <h1>{track?.title ?? "Nenhuma música carregada"}</h1>
    <button onclick={chooseFile} disabled={loading}>
      {loading ? "Carregando…" : "Abrir arquivo…"}
    </button>
  </header>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  {#if track}
    <section class="transport">
      <button class="play" onclick={toggle} aria-label={playing ? "Pausar" : "Tocar"}>
        {playing ? "❚❚" : "▶"}
      </button>
      <time>{formatTime(currentTime)}</time>
      <input
        type="range"
        min="0"
        max={duration || 0}
        step="0.01"
        value={currentTime}
        oninput={scrub}
        aria-label="Posição na música"
      />
      <time class="dim">{formatTime(duration)}</time>
    </section>

    {#if analyzing}
      <p class="pending">Analisando os acordes…</p>
    {:else if analysis}
      <section class="chord" aria-live="polite">
        <strong>{isSilence(currentChord) ? "–" : currentChord?.label}</strong>
        <span class="dim">{analysis.chords.length} acordes · {analysis.dictionary}</span>
      </section>
      <ChordTimeline
        chords={analysis.chords}
        {currentTime}
        onSeek={(seconds) => player.seek(seconds)}
      />
      {#each analysis.warnings as warning}
        <p class="pending">{warning}</p>
      {/each}
    {/if}
  {:else if !loading}
    <p class="pending">Abra um arquivo de áudio para começar.</p>
  {/if}
</main>

<style>
  main {
    max-width: 60rem;
    margin: 0 auto;
    padding: 2rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  h1 {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .transport {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 1rem;
  }

  .play {
    min-width: 3rem;
    font-size: 1rem;
  }

  time {
    font-variant-numeric: tabular-nums;
    font-size: 0.85rem;
  }

  .dim { color: var(--ink-dim); }

  input[type="range"] {
    flex: 1;
    accent-color: var(--accent);
    cursor: pointer;
  }

  .chord {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
  }

  .chord strong {
    font-size: 4rem;
    font-weight: 600;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .pending {
    color: var(--ink-dim);
    margin: 0;
  }

  .error {
    color: #ff8a80;
    background: #2a1c1c;
    border: 1px solid #4a2626;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin: 0;
  }
</style>
