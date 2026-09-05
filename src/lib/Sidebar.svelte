<script lang="ts">
  import type { ViewId } from "./types";

  interface Props {
    current: ViewId;
    onSelect: (view: ViewId) => void;
  }

  const { current, onSelect }: Props = $props();

  const VIEWS: ReadonlyArray<{ id: ViewId; label: string; hint: string }> = [
    { id: "player", label: "Tocar junto", hint: "Acordes da música em tempo real" },
    { id: "scales", label: "Escalas", hint: "Posições no braço da guitarra" },
    { id: "progression", label: "Progressões", hint: "Montar e ouvir sequências" },
  ];

  let open = $state(false);

  function choose(view: ViewId) {
    onSelect(view);
    open = false;
  }
</script>

<!-- Faixa invisível na borda: encostar o mouse à esquerda revela o menu, sem
     precisar acertar o botão. -->
<div
  class="edge"
  role="presentation"
  onmouseenter={() => (open = true)}
></div>

<button
  class="handle"
  class:hidden={open}
  onmouseenter={() => (open = true)}
  onclick={() => (open = !open)}
  aria-label="Abrir menu"
  aria-expanded={open}
>
  <span></span><span></span><span></span>
</button>

<nav
  class="sidebar"
  class:open
  onmouseleave={() => (open = false)}
  aria-label="Seções"
>
  <h2>Musica</h2>
  <ul>
    {#each VIEWS as view}
      <li>
        <button
          class:active={view.id === current}
          onclick={() => choose(view.id)}
          aria-current={view.id === current ? "page" : undefined}
        >
          <strong>{view.label}</strong>
          <small>{view.hint}</small>
        </button>
      </li>
    {/each}
  </ul>
</nav>

<style>
  .edge {
    position: fixed;
    top: 0;
    left: 0;
    width: 14px;
    height: 100vh;
    z-index: 40;
  }

  .handle {
    position: fixed;
    top: 1rem;
    left: 1rem;
    z-index: 42;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    width: 2.2rem;
    height: 2.2rem;
    padding: 0;
    border-radius: 10px;
    background: color-mix(in oklab, var(--surface) 80%, transparent);
    backdrop-filter: blur(8px);
    transition: opacity 160ms ease;
  }

  .handle.hidden { opacity: 0; pointer-events: none; }

  .handle span {
    display: block;
    width: 1rem;
    height: 1px;
    margin: 0 auto;
    background: var(--ink);
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 41;
    width: 16rem;
    height: 100vh;
    padding: 1.25rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    background: color-mix(in oklab, var(--surface) 92%, transparent);
    backdrop-filter: blur(16px);
    border-right: 1px solid var(--line);
    transform: translateX(-100%);
    transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
  }

  .sidebar.open { transform: none; }

  h2 {
    font-family: var(--serif);
    font-size: 1.15rem;
    font-weight: 400;
    margin: 0.35rem 0 0 0.6rem;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  li button {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    text-align: left;
    border: none;
    border-radius: 10px;
    padding: 0.6rem;
  }

  li button:hover:not(:disabled) { background: var(--surface-raised); }

  li button.active {
    background: var(--surface-raised);
    box-shadow: inset 2px 0 0 var(--ink);
  }

  li button strong { font-weight: 500; }
  li button small { color: var(--ink-dim); font-size: 0.75rem; }
</style>
