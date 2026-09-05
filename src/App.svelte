<script lang="ts">
  import { onDestroy } from "svelte";

  import ChordOverview from "./lib/ChordOverview.svelte";
  import ChordTimeline from "./lib/ChordTimeline.svelte";
  import FretboardChord from "./lib/FretboardChord.svelte";
  import Library from "./lib/Library.svelte";
  import Vinyl from "./lib/Vinyl.svelte";
  import SearchResults from "./lib/SearchResults.svelte";
  import {
    analyzeTrack,
    importYoutube,
    libraryList,
    libraryRemove,
    libraryRepair,
    pickAudioFile,
    searchYoutube,
    trackFromEntry,
  } from "./lib/backend";
  import { findVoicings } from "./lib/guitarVoicings";
  import { LatestRequest } from "./lib/latestRequest";
  import { AudioPlayer } from "./lib/audioPlayer";
  import { chordAt, isSilence, uniqueChords } from "./lib/chordTimeline";
  import { formatTime } from "./lib/formatTime";
  import type { ChordAnalysis, LibraryEntry, Track, YoutubeCandidate } from "./lib/types";

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

  const overview = $derived(analysis === null ? [] : uniqueChords(analysis.chords));

  /** Segurar a faixa de acordes espera a música; soltar retoma se estava
   * tocando. Guardar o que era antes evita dar play em algo que estava pausado. */
  let resumeAfterScrub = false;

  function beginScrub() {
    resumeAfterScrub = player.playing;
    if (player.playing) player.pause();
  }

  async function endScrub() {
    if (!resumeAfterScrub) return;
    resumeAfterScrub = false;
    try {
      await player.play();
      playing = player.playing;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  const voicingResult = $derived(
    currentChord === null || isSilence(currentChord) ? null : findVoicings(currentChord.label),
  );
  let positionIndex = $state(0);
  // Trocou o acorde, volta para a primeira posição: manter o índice faria
  // saltar para uma forma alta sem motivo.
  $effect(() => {
    void currentChord?.label;
    positionIndex = 0;
  });
  const voicing = $derived(voicingResult?.voicings[positionIndex] ?? null);
  const positionCount = $derived(voicingResult?.voicings.length ?? 0);

  let library = $state<LibraryEntry[]>([]);
  let currentId = $state<string | null>(null);

  async function refreshLibrary() {
    try {
      library = await libraryList();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  /** Mostra o repertório imediatamente e só depois vai à rede pelos títulos e
   * capas que faltam. Sem isso, uma rede lenta atrasaria a abertura. */
  async function loadLibrary() {
    await refreshLibrary();
    try {
      library = await libraryRepair();
    } catch {
      // Sem rede o repertório continua utilizável; a próxima abertura tenta de novo.
    }
  }
  void loadLibrary();

  async function openEntry(entry: LibraryEntry) {
    error = null;
    loading = true;
    try {
      await loadTrack(trackFromEntry(entry));
      currentId = entry.id;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      loading = false;
    }
  }

  async function removeEntry(entry: LibraryEntry) {
    try {
      await libraryRemove(entry.id);
      if (currentId === entry.id) {
        player.pause();
        track = null;
        analysis = null;
        currentId = null;
      }
      await refreshLibrary();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  let query = $state("");
  let results = $state<YoutubeCandidate[]>([]);
  let searching = $state(false);
  let importingId = $state<string | null>(null);

  const searches = new LatestRequest();
  // Espera a digitação parar antes de buscar: sem isto, cada tecla vira um
  // processo yt-dlp.
  const TYPING_PAUSE_MS = 350;
  let typingTimer: ReturnType<typeof setTimeout> | null = null;

  function onQueryInput() {
    if (typingTimer !== null) clearTimeout(typingTimer);
    if (query.trim() === "") {
      results = [];
      searching = false;
      return;
    }
    searching = true;
    typingTimer = setTimeout(() => void runSearch(query), TYPING_PAUSE_MS);
  }

  async function runSearch(term: string) {
    const ticket = searches.next();
    try {
      const found = await searchYoutube(term);
      if (searches.settle(ticket)) results = found;
    } catch (cause) {
      if (searches.settle(ticket)) {
        error = cause instanceof Error ? cause.message : String(cause);
        results = [];
      }
    } finally {
      if (searches.isCurrent(ticket)) searching = false;
    }
  }

  async function chooseFromYoutube(candidate: YoutubeCandidate) {
    error = null;
    importingId = candidate.id;
    try {
      await openEntry(await importYoutube(candidate.id));
      await refreshLibrary();
      results = [];
      query = "";
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      importingId = null;
    }
  }

  async function loadTrack(chosen: Track) {
    await player.load(chosen.mediaUrl);
    track = chosen;
    duration = player.duration;
    currentTime = 0;
    analysis = null;
    void analyze(chosen);
  }

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
      const entry = await pickAudioFile();
      if (entry === null) return;
      await openEntry(entry);
      await refreshLibrary();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      track = null;
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

  /** O usuário está digitando? A barra de espaço pertence ao campo, então. */
  function isTyping(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target.isContentEditable
    );
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.code !== "Space" || track === null) return;
    if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
    // Sem isto o espaço rolaria a página e ainda acionaria o botão em foco.
    event.preventDefault();
    void toggle();
  }
</script>

<svelte:window onkeydown={onKeyDown} />

<main>
  <header>
    <h1>{track?.title ?? "Nenhuma música carregada"}</h1>
    <button onclick={chooseFile} disabled={loading}>
      {loading ? "Carregando…" : "Abrir arquivo…"}
    </button>
  </header>

  <search>
    <input
      type="search"
      bind:value={query}
      oninput={onQueryInput}
      placeholder="Buscar uma música no YouTube…"
      aria-label="Buscar uma música no YouTube"
    />
    {#if searching}
      <p class="pending">Buscando…</p>
    {:else if results.length > 0}
      <SearchResults {results} busyId={importingId} onSelect={chooseFromYoutube} />
    {/if}
  </search>

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
      <section class="now">
        <Vinyl coverUrl={track.coverUrl} {currentTime} />

        <div class="name" aria-live="polite">
          <strong>{isSilence(currentChord) ? "–" : currentChord?.label}</strong>
          {#if voicingResult?.fidelity === "bassDropped"}
            <small>forma sem o baixo invertido</small>
          {:else if voicingResult?.fidelity === "simplified"}
            <small>forma simplificada · {voicingResult.matchedLabel}</small>
          {/if}
        </div>

        {#if voicing}
          <div class="shape">
            <FretboardChord {voicing} />
            {#if positionCount > 1}
              <div class="positions">
                <button
                  onclick={() => (positionIndex = (positionIndex - 1 + positionCount) % positionCount)}
                  aria-label="Forma anterior"
                >‹</button>
                <span>{positionIndex + 1}/{positionCount}</span>
                <button
                  onclick={() => (positionIndex = (positionIndex + 1) % positionCount)}
                  aria-label="Próxima forma"
                >›</button>
              </div>
            {/if}
          </div>
        {/if}
      </section>
      <ChordTimeline
        chords={analysis.chords}
        {currentTime}
        onSeek={(seconds) => player.seek(seconds)}
        onScrubStart={beginScrub}
        onScrubEnd={endScrub}
      />
      {#each analysis.warnings as warning}
        <p class="pending">{warning}</p>
      {/each}

      {#if overview.length > 0}
        <ChordOverview
          chords={overview}
          currentLabel={currentChord?.label ?? null}
          onJump={(seconds) => player.seek(seconds)}
        />
      {/if}
    {/if}
  {/if}

  <Library
    entries={library}
    {currentId}
    onOpen={openEntry}
    onRemove={removeEntry}
  />
</main>

<style>
  main {
    max-width: 58rem;
    margin: 0 auto;
    padding: 2.5rem 2rem 3rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  h1 {
    font-family: var(--serif);
    font-size: 1.35rem;
    font-weight: 400;
    letter-spacing: -0.01em;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  search {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  input[type="search"] {
    font: inherit;
    color: inherit;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.6rem 0.9rem;
    width: 100%;
  }

  input[type="search"]:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .transport {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 0.75rem 1.25rem;
  }

  .play {
    min-width: 2.75rem;
    font-size: 0.9rem;
    padding: 0.45rem 0;
  }

  time {
    font-variant-numeric: tabular-nums;
    font-size: 0.85rem;
  }

  .dim { color: var(--ink-dim); }

  input[type="range"] {
    flex: 1;
    accent-color: var(--ink);
    cursor: pointer;
  }

  .now {
    display: flex;
    align-items: center;
    gap: 2.5rem;
    padding: 2rem 2.5rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 16px;
    min-height: 15rem;
  }

  .name {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    /* O nome ocupa o meio e empurra o braço para a direita. */
    flex: 1;
  }

  .name strong {
    font-family: var(--serif);
    font-size: 5.5rem;
    font-weight: 400;
    line-height: 0.95;
    letter-spacing: -0.02em;
  }

  .name small {
    color: var(--ink-dim);
    font-size: 0.8rem;
    letter-spacing: 0.02em;
  }

  .shape {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .positions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--ink-dim);
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }

  .positions button {
    padding: 0.1rem 0.6rem;
    border-radius: 999px;
    line-height: 1.4;
  }

  .pending {
    color: var(--ink-dim);
    margin: 0;
  }

  .error {
    color: var(--danger);
    background: #1a1010;
    border: 1px solid #3a1f1c;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin: 0;
  }
</style>
