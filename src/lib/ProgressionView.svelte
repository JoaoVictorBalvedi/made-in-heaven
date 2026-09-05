<script lang="ts">
  import { onDestroy } from "svelte";

  import FretboardChord from "./FretboardChord.svelte";
  import { progressionsList, progressionsRemove, progressionsSave } from "./backend";
  import { searchChords } from "./chordCatalog";
  import type { ChordSynth } from "./chordSynth";
  import { findVoicings } from "./guitarVoicings";
  import { PATTERNS, detectKey, patternChords, suggestNext } from "./progressionIdeas";
  import { reorder } from "./reorder";
  import { NOTE_NAMES, noteIndex } from "./scales";
  import type { SavedProgression } from "./types";

  interface Props {
    synth: ChordSynth;
  }

  const { synth }: Props = $props();

  /** Um acorde da progressão. O identificador permite repetir o mesmo acorde
   * sem que as duas cópias se confundam na lista. */
  interface Step {
    readonly id: number;
    readonly label: string;
    positionIndex: number;
  }

  let query = $state("");
  let steps = $state<Step[]>([]);
  let playingIndex = $state<number | null>(null);
  let secondsPerChord = $state(1.6);
  let nextId = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const results = $derived(searchChords(query, 18));
  const labels = $derived(steps.map((step) => step.label));
  const detected = $derived(detectKey(labels));

  /** O tom vale para as sugestões e para os padrões: um lugar só para escolher.
   * Segue o que foi montado até alguém decidir por conta própria. */
  let chosenRoot = $state<string | null>(null);
  let chosenQuality = $state<"major" | "minor" | null>(null);

  const keyRoot = $derived(
    chosenRoot ?? (detected === null ? "C" : NOTE_NAMES[detected.rootIndex] ?? "C"),
  );
  const keyQuality = $derived(chosenQuality ?? detected?.scaleId ?? "major");
  const following = $derived(chosenRoot === null && chosenQuality === null);
  const activeKey = $derived({ rootIndex: noteIndex(keyRoot), scaleId: keyQuality });
  const suggestions = $derived(suggestNext(labels, activeKey));

  function add(label: string) {
    steps = [...steps, { id: (nextId += 1), label, positionIndex: 0 }];
    hear(steps.length - 1);
  }

  function remove(id: number) {
    steps = steps.filter((step) => step.id !== id);
  }

  function clearAll() {
    stop();
    steps = [];
  }

  function cyclePosition(id: number, total: number, offset: number) {
    steps = steps.map((step) =>
      step.id === id
        ? { ...step, positionIndex: (step.positionIndex + offset + total) % total }
        : step,
    );
  }

  function voicingFor(step: Step) {
    const result = findVoicings(step.label);
    return { result, voicing: result?.voicings[step.positionIndex] };
  }

  function hear(index: number) {
    const step = steps[index];
    if (step === undefined) return;
    const { voicing } = voicingFor(step);
    if (voicing !== undefined) synth.strum(voicing.midi);
  }

  function stop() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    playingIndex = null;
  }

  function playAll() {
    stop();
    if (steps.length === 0) return;
    const advance = (index: number) => {
      if (index >= steps.length) {
        stop();
        return;
      }
      playingIndex = index;
      hear(index);
      timer = setTimeout(() => advance(index + 1), secondsPerChord * 1000);
    };
    advance(0);
  }

  let saved = $state<SavedProgression[]>([]);
  let saveName = $state("");
  let saveError = $state<string | null>(null);

  async function refreshSaved() {
    try {
      saved = await progressionsList();
    } catch (cause) {
      saveError = cause instanceof Error ? cause.message : String(cause);
    }
  }
  void refreshSaved();

  async function save() {
    saveError = null;
    try {
      await progressionsSave(saveName, labels);
      saveName = "";
      await refreshSaved();
    } catch (cause) {
      saveError = cause instanceof Error ? cause.message : String(cause);
    }
  }

  function load(entry: SavedProgression) {
    stop();
    steps = entry.chords.map((label) => ({ id: (nextId += 1), label, positionIndex: 0 }));
    // Carregar uma progressão salva volta o tom ao automático: ela pode estar
    // em outra tonalidade que a escolhida à mão.
    chosenRoot = null;
    chosenQuality = null;
  }

  async function forget(id: string) {
    try {
      await progressionsRemove(id);
      await refreshSaved();
    } catch (cause) {
      saveError = cause instanceof Error ? cause.message : String(cause);
    }
  }

  function usePattern(chords: readonly string[]) {
    steps = chords.map((label) => ({ id: (nextId += 1), label, positionIndex: 0 }));
    hear(0);
  }

  // Arrastar para reordenar. O índice sob o cursor fica destacado para a
  // posição de destino ser visível antes de soltar.
  let dragIndex = $state<number | null>(null);
  let overIndex = $state<number | null>(null);

  function onDragStart(event: DragEvent, index: number) {
    dragIndex = index;
    if (event.dataTransfer !== null) {
      event.dataTransfer.effectAllowed = "move";
      // O Firefox só inicia o arrasto se algum dado for definido.
      event.dataTransfer.setData("text/plain", String(index));
    }
  }

  function onDragOver(event: DragEvent, index: number) {
    if (dragIndex === null) return;
    event.preventDefault();
    overIndex = index;
  }

  function onDrop(event: DragEvent, index: number) {
    event.preventDefault();
    if (dragIndex !== null) steps = [...reorder(steps, dragIndex, index)];
    dragIndex = null;
    overIndex = null;
  }

  function onDragEnd() {
    dragIndex = null;
    overIndex = null;
  }

  onDestroy(stop);
</script>

<section class="progression">
  <header>
    <h1>Progressões</h1>
    <div class="controls">
      {#if steps.length > 0}
        <label>
          <span>ritmo</span>
          <input type="range" min="0.6" max="3" step="0.1" bind:value={secondsPerChord} />
          <span class="value">{secondsPerChord.toFixed(1)}s</span>
        </label>
        <button onclick={playingIndex === null ? playAll : stop}>
          {playingIndex === null ? "▶ Tocar" : "❚❚ Parar"}
        </button>
        <button class="clear" onclick={clearAll}>Limpar</button>
      {/if}
    </div>
  </header>

  <div class="key-bar">
    <span class="key-label">Tom</span>
    <div class="roots">
      {#each NOTE_NAMES as name}
        <button class:active={name === keyRoot} onclick={() => (chosenRoot = name)}>{name}</button>
      {/each}
    </div>
    <div class="quality">
      <button class:active={keyQuality === "major"} onclick={() => (chosenQuality = "major")}>maior</button>
      <button class:active={keyQuality === "minor"} onclick={() => (chosenQuality = "minor")}>menor</button>
    </div>
    {#if following}
      <span class="auto">seguindo a progressão</span>
    {:else}
      <button
        class="auto-reset"
        onclick={() => { chosenRoot = null; chosenQuality = null; }}
      >voltar ao automático</button>
    {/if}
  </div>

  {#if steps.length === 0}
    <p class="empty-state">
      Escolha acordes nas sugestões abaixo, procure pelo nome, ou comece por um
      padrão. Cada acorde toca ao entrar, para você ir ouvindo a progressão nascer.
    </p>
  {:else}
    <ol class="steps">
      {#each steps as step, index (step.id)}
        {@const { result, voicing } = voicingFor(step)}
        <li
          class:playing={playingIndex === index}
          class:dragging={dragIndex === index}
          class:over={overIndex === index && dragIndex !== index}
          draggable="true"
          ondragstart={(event) => onDragStart(event, index)}
          ondragover={(event) => onDragOver(event, index)}
          ondrop={(event) => onDrop(event, index)}
          ondragend={onDragEnd}
        >
          <button class="name" onclick={() => hear(index)} title="Ouvir">{step.label}</button>

          {#if voicing}
            <FretboardChord {voicing} />
          {/if}

          <footer>
            {#if result && result.voicings.length > 1}
              <button onclick={() => cyclePosition(step.id, result.voicings.length, -1)} aria-label="Forma anterior">‹</button>
              <span>{step.positionIndex + 1}/{result.voicings.length}</span>
              <button onclick={() => cyclePosition(step.id, result.voicings.length, 1)} aria-label="Próxima forma">›</button>
            {/if}
            <button class="remove" onclick={() => remove(step.id)} aria-label="Remover da progressão">×</button>
          </footer>
        </li>
      {/each}
    </ol>
    <div class="save-row">
      <p class="hint">Arraste os cartões para reordenar.</p>
      <form
        onsubmit={(event) => { event.preventDefault(); void save(); }}
      >
        <input
          type="text"
          bind:value={saveName}
          placeholder="Nome da progressão"
          aria-label="Nome da progressão"
          maxlength="80"
        />
        <button type="submit" disabled={saveName.trim() === ""}>Salvar</button>
      </form>
    </div>
    {#if saveError}
      <p class="save-error" role="alert">{saveError}</p>
    {/if}
  {/if}

  {#if saved.length > 0}
    <div class="ideas">
      <h2>Salvas</h2>
      <ul class="saved">
        {#each saved as entry (entry.id)}
          <li>
            <button class="load" onclick={() => load(entry)}>
              <strong>{entry.name}</strong>
              <small>{entry.chords.join("  ·  ")}</small>
            </button>
            <button
              class="remove"
              onclick={() => forget(entry.id)}
              aria-label={`Apagar ${entry.name}`}
              title="Apagar"
            >×</button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if suggestions.length > 0}
    <div class="ideas">
      <h2>O que costuma vir agora</h2>
      <ul class="suggestions">
        {#each suggestions as suggestion (suggestion.label)}
          <li>
            <button onclick={() => add(suggestion.label)}>
              <strong>{suggestion.label}</strong>
              <em>{suggestion.roman}</em>
              <small>{suggestion.reason}</small>
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="search">
    <input
      type="search"
      bind:value={query}
      placeholder="Ou procure qualquer acorde: Am, G7, Fmaj7…"
      aria-label="Procurar um acorde"
    />
    <ul class="results">
      {#each results as label (label)}
        <li><button onclick={() => add(label)}>{label}</button></li>
      {/each}
      {#if results.length === 0}
        <li class="empty">Nenhum acorde com esse nome.</li>
      {/if}
    </ul>
  </div>

  <div class="ideas">
    <h2>Padrões em {keyRoot} {keyQuality === "major" ? "maior" : "menor"}</h2>
    <ul class="patterns">
      {#each PATTERNS as pattern (pattern.id)}
        {@const chords = patternChords(pattern, noteIndex(keyRoot))}
        <li>
          <div class="pattern-head">
            <strong>{pattern.name}</strong>
            <span class="mood">{pattern.mood}</span>
          </div>
          <p class="pattern-note">{pattern.note}</p>
          <div class="pattern-foot">
            <span class="chords">{chords.join("  ·  ")}</span>
            <button onclick={() => usePattern(chords)} title="Substitui a progressão atual">
              usar
            </button>
          </div>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style>
  .progression { display: flex; flex-direction: column; gap: 1.25rem; }

  header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }

  h1 {
    font-family: var(--serif);
    font-size: 1.6rem;
    font-weight: 400;
    margin: 0;
  }

  .controls { display: flex; align-items: center; gap: 0.75rem; }

  .controls label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--ink-dim);
    font-size: 0.8rem;
  }

  .controls input[type="range"] { width: 6rem; accent-color: var(--ink); }
  .controls .value { font-variant-numeric: tabular-nums; min-width: 2.2rem; }
  .clear:hover:not(:disabled) { border-color: var(--danger); color: var(--danger); }

  .key-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 0.5rem 1rem;
  }

  .key-label {
    color: var(--ink-dim);
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .roots, .quality { display: flex; flex-wrap: wrap; gap: 0.2rem; }
  .roots button { padding: 0.15rem 0.5rem; font-size: 0.78rem; border-radius: 8px; }
  .quality button { padding: 0.15rem 0.65rem; font-size: 0.78rem; border-radius: 8px; }

  .key-bar button.active {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--ground);
  }

  .auto { color: var(--ink-dim); font-size: 0.72rem; margin-left: auto; }

  .auto-reset {
    margin-left: auto;
    border: none;
    color: var(--ink-dim);
    font-size: 0.72rem;
    padding: 0.1rem 0.5rem;
  }

  .auto-reset:hover:not(:disabled) { background: transparent; color: var(--ink); }

  .search { display: flex; flex-direction: column; gap: 0.75rem; }

  input[type="search"] {
    font: inherit;
    color: inherit;
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    padding: 0.55rem 1rem;
  }

  input[type="search"]:focus-visible { outline: 1px solid var(--ink); outline-offset: 2px; }

  .results {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .results button { padding: 0.3rem 0.8rem; font-size: 0.9rem; }
  .results .empty { color: var(--ink-dim); font-size: 0.85rem; }

  .empty-state {
    color: var(--ink-dim);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 2rem;
    margin: 0;
    text-align: center;
  }

  .hint { color: var(--ink-dim); font-size: 0.75rem; margin: 0; }

  .save-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    margin-top: -0.25rem;
  }

  .save-row form { display: flex; gap: 0.4rem; }

  .save-row input {
    font: inherit;
    color: inherit;
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    padding: 0.35rem 0.9rem;
    width: 12rem;
  }

  .save-row input:focus-visible { outline: 1px solid var(--ink); outline-offset: 2px; }
  .save-row button { padding: 0.3rem 0.9rem; font-size: 0.8rem; }

  .save-error { color: var(--danger); font-size: 0.8rem; margin: 0; }

  .saved {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .saved li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 1px solid var(--line);
  }

  .saved li:last-child { border-bottom: none; }

  .load {
    flex: 1;
    display: flex;
    align-items: baseline;
    gap: 1rem;
    border: none;
    border-radius: 0;
    padding: 0.55rem 0.25rem;
    text-align: left;
  }

  .load:hover:not(:disabled) { background: transparent; }
  .load strong { font-weight: 500; }
  .load small { color: var(--ink-dim); font-family: var(--serif); font-size: 0.9rem; }

  .saved .remove {
    border: none;
    color: var(--ink-dim);
    font-size: 1.1rem;
    padding: 0.2rem 0.5rem;
    opacity: 0;
  }

  .saved li:hover .remove { opacity: 1; }
  .saved .remove:focus-visible { opacity: 1; }

  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .steps li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 0.75rem 0.6rem 0.5rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 14px;
    cursor: grab;
    transition: opacity 120ms ease, border-color 120ms ease;
  }

  .steps li.playing { border-color: var(--ink); }
  .steps li.dragging { opacity: 0.35; cursor: grabbing; }
  /* O destino fica marcado antes de soltar, para o resultado não surpreender. */
  .steps li.over { border-color: var(--ink); box-shadow: -3px 0 0 var(--ink); }

  .name {
    font-family: var(--serif);
    font-size: 1.5rem;
    font-weight: 400;
    border: none;
    padding: 0 0.4rem;
    line-height: 1.15;
  }

  .name:hover:not(:disabled) {
    background: transparent;
    text-decoration: underline;
    text-underline-offset: 4px;
  }

  footer {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--ink-dim);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
  }

  footer button {
    border: none;
    color: var(--ink-dim);
    padding: 0 0.35rem;
    line-height: 1.3;
  }

  footer button:hover:not(:disabled) { background: transparent; color: var(--ink); }
  .remove:hover:not(:disabled) { color: var(--danger); }

  .ideas {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 1.25rem 1.5rem 1.5rem;
  }

  .ideas h2 {
    font-family: var(--serif);
    font-size: 1.05rem;
    font-weight: 400;
    margin: 0 0 1rem;
  }

  .suggestions {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .suggestions button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.1rem;
    padding: 0.6rem 0.9rem;
    border-radius: 12px;
    min-width: 8.5rem;
  }

  .suggestions strong { font-family: var(--serif); font-size: 1.3rem; font-weight: 400; }
  .suggestions em { color: var(--ink-dim); font-size: 0.75rem; font-style: normal; }
  .suggestions small { color: var(--ink-dim); font-size: 0.7rem; }

  .patterns {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
    gap: 0.6rem;
  }

  .patterns li {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.85rem 1rem;
    background: var(--ground);
    border: 1px solid var(--line);
    border-radius: 12px;
  }

  .pattern-head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
  .pattern-head strong { font-weight: 500; font-variant-numeric: tabular-nums; }
  .mood { color: var(--ink-dim); font-size: 0.7rem; text-align: right; }

  .pattern-note { color: var(--ink-dim); font-size: 0.75rem; margin: 0; line-height: 1.45; }

  .pattern-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.25rem;
  }

  .chords { font-family: var(--serif); font-size: 0.95rem; color: var(--ink); }
  .pattern-foot button { padding: 0.2rem 0.7rem; font-size: 0.75rem; }
</style>
