<script lang="ts">
  import FretboardChord from "./FretboardChord.svelte";
  import { findVoicings } from "./guitarVoicings";
  import type { ChordSummary } from "./chordTimeline";

  interface Props {
    chords: readonly ChordSummary[];
    /** O acorde que soa agora, para destacá-lo no meio dos outros. */
    currentLabel?: string | null;
    /** Pular para a primeira vez em que o acorde aparece. */
    onJump?: (seconds: number) => void;
  }

  const { chords, currentLabel = null, onJump }: Props = $props();

  /** Qual forma está sendo mostrada para cada acorde, por rótulo. */
  let positions = $state<Record<string, number>>({});

  function cycle(label: string, total: number, step: number) {
    const current = positions[label] ?? 0;
    positions = { ...positions, [label]: (current + step + total) % total };
  }
</script>

<section class="overview">
  <header>
    <h2>Acordes da música</h2>
    <span class="count">{chords.length} {chords.length === 1 ? "acorde" : "acordes"}</span>
  </header>

  <ul>
    {#each chords as summary (summary.label)}
      {@const result = findVoicings(summary.label)}
      {@const index = positions[summary.label] ?? 0}
      {@const voicing = result?.voicings[index]}
      <li class:current={summary.label === currentLabel}>
        <button
          class="label"
          onclick={() => onJump?.(summary.firstSeconds)}
          title="Ir para a primeira vez que aparece"
        >
          {summary.label}
        </button>

        {#if voicing}
          <FretboardChord {voicing} />
        {:else}
          <p class="unknown">sem forma catalogada</p>
        {/if}

        <footer>
          {#if result && result.voicings.length > 1}
            <button
              onclick={() => cycle(summary.label, result.voicings.length, -1)}
              aria-label={`Forma anterior de ${summary.label}`}
            >‹</button>
            <span>{index + 1}/{result.voicings.length}</span>
            <button
              onclick={() => cycle(summary.label, result.voicings.length, 1)}
              aria-label={`Próxima forma de ${summary.label}`}
            >›</button>
          {:else}
            <span class="times">{summary.occurrences}×</span>
          {/if}
        </footer>
      </li>
    {/each}
  </ul>
</section>

<style>
  .overview {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 1.25rem 1.5rem 1.5rem;
  }

  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  h2 {
    font-family: var(--serif);
    font-size: 1.1rem;
    font-weight: 400;
    margin: 0;
  }

  .count {
    color: var(--ink-dim);
    font-size: 0.8rem;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
    gap: 0.75rem;
  }

  li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 0.9rem 0.5rem 0.6rem;
    background: var(--ground);
    border: 1px solid var(--line);
    border-radius: 12px;
  }

  /* O acorde que soa agora se destaca sem cor, para não competir com a
     timeline, onde a cor já significa "é este aqui". */
  li.current { border-color: var(--ink-dim); }

  .label {
    font-family: var(--serif);
    font-size: 1.6rem;
    font-weight: 400;
    border: none;
    padding: 0 0.3rem;
    line-height: 1.1;
  }

  .label:hover:not(:disabled) {
    background: transparent;
    text-decoration: underline;
    text-underline-offset: 4px;
  }

  footer {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--ink-dim);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    min-height: 1.6rem;
  }

  footer button {
    border: none;
    padding: 0 0.4rem;
    line-height: 1.3;
    color: var(--ink-dim);
  }

  footer button:hover:not(:disabled) {
    background: transparent;
    color: var(--ink);
  }

  .unknown {
    color: var(--ink-dim);
    font-size: 0.75rem;
    margin: 0;
    padding: 2rem 0;
    text-align: center;
  }
</style>
