<script lang="ts">
  import { formatTime } from "./formatTime";
  import type { YoutubeCandidate } from "./types";

  interface Props {
    results: readonly YoutubeCandidate[];
    busyId?: string | null;
    onSelect: (candidate: YoutubeCandidate) => void;
  }

  const { results, busyId = null, onSelect }: Props = $props();
</script>

<ul class="results">
  {#each results as candidate (candidate.id)}
    <li>
      <button onclick={() => onSelect(candidate)} disabled={busyId !== null}>
        {#if candidate.thumbnail}
          <!-- A miniatura é decorativa: o título ao lado já nomeia o resultado. -->
          <img src={candidate.thumbnail} alt="" loading="lazy" />
        {:else}
          <span class="no-thumb" aria-hidden="true"></span>
        {/if}
        <span class="meta">
          <strong>{candidate.title}</strong>
          <small>
            {candidate.channel}
            {#if candidate.durationSeconds !== null}
              · {formatTime(candidate.durationSeconds)}
            {/if}
          </small>
        </span>
        {#if busyId === candidate.id}
          <span class="status">baixando…</span>
        {/if}
      </button>
    </li>
  {/each}
</ul>

<style>
  .results {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 22rem;
    overflow-y: auto;
  }

  button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    text-align: left;
    padding: 0.5rem;
    background: transparent;
    border-color: transparent;
  }

  button:hover:not(:disabled) { background: var(--surface); }

  img,
  .no-thumb {
    width: 5rem;
    height: 2.8rem;
    object-fit: cover;
    border-radius: 4px;
    background: var(--surface);
    flex-shrink: 0;
  }

  .meta {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    overflow: hidden;
  }

  .meta strong {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta small { color: var(--ink-dim); }

  .status {
    margin-left: auto;
    color: var(--accent);
    font-size: 0.85rem;
    white-space: nowrap;
  }
</style>
