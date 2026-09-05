<script lang="ts">
  import ScaleFretboard from "./ScaleFretboard.svelte";
  import { ChordSynth } from "./chordSynth";
  import { findVoicings } from "./guitarVoicings";
  import {
    NOTE_NAMES,
    SCALES,
    diatonicChords,
    noteIndex,
    scaleOnFretboard,
    scalesInKey,
  } from "./scales";

  interface Props {
    synth: ChordSynth;
  }

  const { synth }: Props = $props();

  let root = $state("A");
  let scaleId = $state("pentatonic-minor");
  let labelMode = $state<"note" | "degree">("degree");

  /** Dois jeitos de chegar na mesma escala: escolhendo-a diretamente, ou
   * escolhendo um tom e vendo o que serve sobre ele. */
  let mode = $state<"free" | "key">("free");
  let keyRoot = $state("C");
  let keyQuality = $state<"major" | "minor">("major");

  const inKey = $derived(scalesInKey(noteIndex(keyRoot), keyQuality));

  function pickFromKey(entry: (typeof inKey)[number]) {
    root = entry.rootName;
    scaleId = entry.scale.id;
  }

  const scale = $derived(SCALES.find((entry) => entry.id === scaleId) ?? SCALES[0]!);
  const rootIndex = $derived(noteIndex(root));
  const notes = $derived(scaleOnFretboard(rootIndex, scale));
  const chords = $derived(diatonicChords(rootIndex, scale));

  /** Toca o acorde na primeira forma catalogada, para ouvir o grau soando. */
  function hear(label: string) {
    const voicing = findVoicings(label)?.voicings[0];
    if (voicing !== undefined) synth.strum(voicing.midi);
  }
</script>

<section class="scales">
  <header>
    <h1>Escalas</h1>
    <div class="labels">
      <button class:active={labelMode === "degree"} onclick={() => (labelMode = "degree")}>graus</button>
      <button class:active={labelMode === "note"} onclick={() => (labelMode = "note")}>notas</button>
    </div>
  </header>

  <div class="modes">
    <button class:active={mode === "free"} onclick={() => (mode = "free")}>Escolher a escala</button>
    <button class:active={mode === "key"} onclick={() => (mode = "key")}>Escolher o tom</button>
  </div>

  <div class="picker">
    {#if mode === "free"}
      <fieldset>
        <legend>Tônica</legend>
        <div class="notes">
          {#each NOTE_NAMES as name}
            <button class:active={name === root} onclick={() => (root = name)}>{name}</button>
          {/each}
        </div>
      </fieldset>

      <fieldset>
        <legend>Escala</legend>
        <div class="scale-list">
          {#each SCALES as entry}
            <button class:active={entry.id === scaleId} onclick={() => (scaleId = entry.id)}>
              {entry.name}
            </button>
          {/each}
        </div>
      </fieldset>
    {:else}
      <fieldset>
        <legend>Tom</legend>
        <div class="notes">
          {#each NOTE_NAMES as name}
            <button class:active={name === keyRoot} onclick={() => (keyRoot = name)}>{name}</button>
          {/each}
          <span class="divider"></span>
          <button class:active={keyQuality === "major"} onclick={() => (keyQuality = "major")}>maior</button>
          <button class:active={keyQuality === "minor"} onclick={() => (keyQuality = "minor")}>menor</button>
        </div>
      </fieldset>

      <fieldset>
        <legend>Escalas que servem sobre {keyRoot} {keyQuality === "major" ? "maior" : "menor"}</legend>
        <p class="explain">
          Os sete modos têm exatamente as mesmas notas — muda apenas onde está o
          repouso. As pentatônicas e o blues são o que se costuma usar para
          improvisar neste tom.
        </p>
        <div class="scale-list">
          {#each inKey as entry (entry.rootName + entry.scale.id + entry.role)}
            <button
              class:active={entry.rootName === root && entry.scale.id === scaleId}
              onclick={() => pickFromKey(entry)}
            >
              <strong>{entry.rootName} {entry.scale.name}</strong>
              <small>{entry.role}</small>
            </button>
          {/each}
        </div>
      </fieldset>
    {/if}
  </div>

  <div class="board">
    <h2>{root} {scale.name}</h2>
    <ScaleFretboard {notes} {labelMode} />
  </div>

  {#if chords.length > 0}
    <div class="harmony">
      <h2>Acordes que nascem desta escala</h2>
      <p class="hint">Clique para ouvir. É por isso que uma música nesta tonalidade usa justamente estes.</p>
      <ul>
        {#each chords as chord, degree}
          <li>
            <button onclick={() => hear(chord)}>
              <strong>{chord}</strong>
              <small>{scale.degrees[degree]}</small>
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</section>

<style>
  .scales { display: flex; flex-direction: column; gap: 1.5rem; }

  header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }

  h1 {
    font-family: var(--serif);
    font-size: 1.6rem;
    font-weight: 400;
    margin: 0;
  }

  h2 {
    font-family: var(--serif);
    font-size: 1.05rem;
    font-weight: 400;
    margin: 0 0 0.75rem;
  }

  .labels { display: flex; gap: 0.25rem; }
  .labels button { padding: 0.25rem 0.75rem; font-size: 0.8rem; }

  .picker { display: flex; flex-direction: column; gap: 1.25rem; }

  .modes { display: flex; gap: 0.35rem; }
  .modes button { padding: 0.35rem 0.9rem; font-size: 0.85rem; }

  .divider {
    width: 1px;
    align-self: stretch;
    background: var(--line-strong);
    margin: 0 0.35rem;
  }

  .explain {
    color: var(--ink-dim);
    font-size: 0.78rem;
    line-height: 1.5;
    margin: -0.25rem 0 0.75rem;
    max-width: 46rem;
  }

  .scale-list button strong { display: block; font-weight: 500; }
  .scale-list button small { display: block; color: var(--ink-dim); font-size: 0.7rem; }
  .scale-list button.active small { color: color-mix(in oklab, var(--ground) 65%, transparent); }

  fieldset {
    border: none;
    margin: 0;
    padding: 0;
  }

  legend {
    color: var(--ink-dim);
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0 0 0.5rem;
  }

  .notes, .scale-list { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .notes button { min-width: 2.75rem; padding: 0.35rem 0.5rem; font-variant-numeric: tabular-nums; }
  .scale-list button { padding: 0.35rem 0.85rem; font-size: 0.85rem; }

  button.active {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--ground);
  }

  button.active:hover { background: var(--ink); border-color: var(--ink); }

  .board, .harmony {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 1.25rem 1.5rem 1.5rem;
  }

  .hint { color: var(--ink-dim); font-size: 0.8rem; margin: -0.5rem 0 0.9rem; }

  .harmony ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .harmony li button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    min-width: 4.5rem;
    padding: 0.6rem 0.75rem;
    border-radius: 12px;
  }

  .harmony strong { font-family: var(--serif); font-size: 1.25rem; font-weight: 400; }
  .harmony small { color: var(--ink-dim); font-size: 0.7rem; }
</style>
