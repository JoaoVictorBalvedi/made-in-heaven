<script lang="ts">
  import { filterLibrary } from "./libraryFilter";
  import type { LibraryEntry } from "./types";

  interface Props {
    entries: readonly LibraryEntry[];
    currentId?: string | null;
    onOpen: (entry: LibraryEntry) => void;
    onRemove: (entry: LibraryEntry) => void;
  }

  const { entries, currentId = null, onOpen, onRemove }: Props = $props();

  let query = $state("");
  const shown = $derived(filterLibrary(entries, query));
</script>

<section class="library">
  <header>
    <h2>Repertório</h2>
    <span class="count">{entries.length} {entries.length === 1 ? "música" : "músicas"}</span>
  </header>

  {#if entries.length > 0}
    <input
      type="search"
      bind:value={query}
      placeholder="Filtrar o que já está guardado…"
      aria-label="Filtrar o repertório"
    />
  {/if}

  {#if entries.length === 0}
    <p class="empty">
      Nada guardado ainda. Busque no YouTube ou abra um arquivo — o que entrar
      fica aqui.
    </p>
  {:else if shown.length === 0}
    <p class="empty">Nenhuma música do repertório corresponde a essa busca.</p>
  {:else}
    <ul>
      {#each shown as entry (entry.id)}
        <li class:current={entry.id === currentId}>
          <button class="open" onclick={() => onOpen(entry)}>
            <span class="title">{entry.title}</span>
            <span class="origin">{entry.source === "youtube" ? "YouTube" : "arquivo"}</span>
          </button>
          <button
            class="remove"
            onclick={() => onRemove(entry)}
            aria-label={`Remover ${entry.title} do repertório`}
            title="Remover do repertório"
          >×</button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .library {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
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

  input[type="search"] {
    font: inherit;
    color: inherit;
    background: var(--ground);
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    padding: 0.45rem 0.9rem;
  }

  input[type="search"]:focus-visible {
    outline: 1px solid var(--ink);
    outline-offset: 2px;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    max-height: 20rem;
    overflow-y: auto;
  }

  li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 1px solid var(--line);
  }

  li:last-child { border-bottom: none; }

  .open {
    flex: 1;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    border: none;
    border-radius: 0;
    padding: 0.6rem 0.25rem;
    text-align: left;
  }

  .open:hover:not(:disabled) { background: transparent; color: var(--ink); }

  li.current .title {
    /* A música aberta agora fica marcada sem precisar de cor. */
    text-decoration: underline;
    text-underline-offset: 4px;
  }

  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .origin {
    color: var(--ink-dim);
    font-size: 0.75rem;
    white-space: nowrap;
  }

  .remove {
    border: none;
    color: var(--ink-dim);
    padding: 0.2rem 0.5rem;
    font-size: 1.1rem;
    line-height: 1;
    opacity: 0;
  }

  li:hover .remove { opacity: 1; }
  .remove:hover { color: var(--danger); background: transparent; }
  .remove:focus-visible { opacity: 1; }
</style>
