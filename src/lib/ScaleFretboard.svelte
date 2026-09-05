<script lang="ts">
  import type { ScaleNote } from "./scales";

  interface Props {
    notes: readonly ScaleNote[];
    maxFret?: number;
    /** Mostrar o nome da nota ou o grau dentro da escala. */
    labelMode?: "note" | "degree";
  }

  const { notes, maxFret = 15, labelMode = "degree" }: Props = $props();

  const STRINGS = 6;
  const FRET_WIDTH = 52;
  const STRING_GAP = 26;
  const LEFT = 34;
  const TOP = 26;

  const width = $derived(LEFT + FRET_WIDTH * (maxFret + 1) + 16);
  const height = TOP * 2 + STRING_GAP * (STRINGS - 1);

  /** A primeira corda fica em cima, como numa tablatura. */
  const stringY = (index: number) => TOP + (STRINGS - 1 - index) * STRING_GAP;
  /** Casa 0 é a corda solta, desenhada antes da pestana. */
  const fretX = (fret: number) => LEFT + fret * FRET_WIDTH - FRET_WIDTH / 2;
  const fretLineX = (fret: number) => LEFT + (fret - 1) * FRET_WIDTH;

  const SINGLE_MARKERS = [3, 5, 7, 9, 15, 17, 19, 21];
  const markers = $derived(
    Array.from({ length: maxFret }, (_, index) => index + 1).filter(
      (fret) => SINGLE_MARKERS.includes(fret) || fret === 12 || fret === 24,
    ),
  );
</script>

<div class="scroll">
  <svg viewBox="0 0 {width} {height}" {width} {height} role="img" aria-label="Escala no braço da guitarra">
    {#each markers as fret}
      <g class="marker">
        {#if fret === 12 || fret === 24}
          <circle cx={fretX(fret)} cy={stringY(3) - STRING_GAP / 2} r="4" />
          <circle cx={fretX(fret)} cy={stringY(2) + STRING_GAP / 2} r="4" />
        {:else}
          <circle cx={fretX(fret)} cy={(stringY(0) + stringY(5)) / 2} r="4" />
        {/if}
      </g>
    {/each}

    {#each Array(maxFret + 1) as _, fret}
      {#if fret > 0}
        <line
          class="fret"
          class:nut={fret === 1}
          x1={fretLineX(fret)} y1={stringY(5)}
          x2={fretLineX(fret)} y2={stringY(0)}
        />
      {/if}
    {/each}
    <line
      class="fret"
      x1={fretLineX(maxFret + 1)} y1={stringY(5)}
      x2={fretLineX(maxFret + 1)} y2={stringY(0)}
    />

    {#each Array(STRINGS) as _, index}
      <line
        class="string"
        x1={LEFT - FRET_WIDTH} y1={stringY(index)}
        x2={fretLineX(maxFret + 1)} y2={stringY(index)}
      />
    {/each}

    {#each markers as fret}
      <text class="fret-number" x={fretX(fret)} y={height - 6}>{fret}</text>
    {/each}

    {#each notes as note (note.string * 100 + note.fret)}
      <g class="note" class:root={note.isRoot}>
        <circle cx={fretX(note.fret)} cy={stringY(note.string)} r="10" />
        <text x={fretX(note.fret)} y={stringY(note.string)}>
          {labelMode === "note" ? note.noteName : note.degree}
        </text>
      </g>
    {/each}
  </svg>
</div>

<style>
  .scroll {
    overflow-x: auto;
    padding-bottom: 0.25rem;
  }

  svg { display: block; }

  .string { stroke: var(--line-strong); stroke-width: 1; }
  .fret { stroke: var(--line-strong); stroke-width: 1; }
  .fret.nut { stroke: var(--ink); stroke-width: 3.5; }

  .marker circle { fill: var(--line-strong); }

  .fret-number {
    fill: var(--ink-dim);
    font-size: 11px;
    text-anchor: middle;
  }

  .note circle {
    fill: var(--surface-raised);
    stroke: var(--ink-dim);
    stroke-width: 1;
  }

  .note text {
    fill: var(--ink-dim);
    font-size: 10px;
    font-weight: 500;
    text-anchor: middle;
    dominant-baseline: central;
  }

  /* A tônica é a referência para tudo: precisa saltar sem depender de cor. */
  .note.root circle { fill: var(--ink); stroke: var(--ink); }
  .note.root text { fill: var(--ground); font-weight: 700; }
</style>
