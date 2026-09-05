<script lang="ts">
  import type { Voicing } from "./guitarVoicings";

  interface Props {
    voicing: Voicing;
    /** Quantas casas mostrar. Cinco cobre qualquer forma do banco. */
    frets?: number;
  }

  const { voicing, frets: fretCount = 5 }: Props = $props();

  const STRINGS = 6;
  const STRING_GAP = 22;
  const FRET_GAP = 30;
  const ORIGIN_X = 26;
  /** Espaço acima da pestana para os símbolos de corda solta e abafada. */
  const ORIGIN_Y = 26;

  const width = ORIGIN_X * 2 + STRING_GAP * (STRINGS - 1);
  const height = $derived(ORIGIN_Y + FRET_GAP * fretCount + 14);

  const stringX = (index: number) => ORIGIN_X + index * STRING_GAP;
  const fretY = (fret: number) => ORIGIN_Y + fret * FRET_GAP;
  /** O dedo fica entre dois trastes, não em cima de um. */
  const dotY = (fret: number) => fretY(fret) - FRET_GAP / 2;

  // A pestana só é desenhada como barra quando a mão realmente cobre um trecho.
  const barres = $derived(
    voicing.barres.map((fret) => {
      const covered = voicing.frets
        .map((value, index) => ({ value, index }))
        .filter((entry) => entry.value === fret);
      const first = covered[0]?.index ?? 0;
      const last = covered[covered.length - 1]?.index ?? first;
      return { fret, first, last };
    }),
  );
</script>

<svg
  viewBox="0 0 {width} {height}"
  {width}
  {height}
  role="img"
  aria-label="Diagrama do acorde no braço da guitarra"
>
  <!-- Pestana do instrumento: grossa só quando a forma começa na primeira casa. -->
  <line
    class="nut"
    class:open={voicing.baseFret === 1}
    x1={stringX(0)} y1={fretY(0)}
    x2={stringX(STRINGS - 1)} y2={fretY(0)}
  />

  {#each Array(fretCount) as _, index}
    <line
      class="fret"
      x1={stringX(0)} y1={fretY(index + 1)}
      x2={stringX(STRINGS - 1)} y2={fretY(index + 1)}
    />
  {/each}

  {#each Array(STRINGS) as _, index}
    <line
      class="string"
      x1={stringX(index)} y1={fretY(0)}
      x2={stringX(index)} y2={fretY(fretCount)}
    />
  {/each}

  {#if voicing.baseFret > 1}
    <text class="base-fret" x={stringX(0) - 12} y={dotY(1)}>{voicing.baseFret}</text>
  {/if}

  {#each barres as barre}
    <line
      class="barre"
      x1={stringX(barre.first)} y1={dotY(barre.fret)}
      x2={stringX(barre.last)} y2={dotY(barre.fret)}
    />
  {/each}

  {#each voicing.frets as fret, index}
    {#if fret === -1}
      <!-- Corda abafada. -->
      <g class="muted" transform="translate({stringX(index)}, {ORIGIN_Y - 13})">
        <line x1="-4" y1="-4" x2="4" y2="4" />
        <line x1="-4" y1="4" x2="4" y2="-4" />
      </g>
    {:else if fret === 0}
      <!-- Corda solta. -->
      <circle class="open" cx={stringX(index)} cy={ORIGIN_Y - 13} r="4.5" />
    {:else}
      <circle class="dot" cx={stringX(index)} cy={dotY(fret)} r="9" />
      {#if voicing.fingers[index]}
        <text class="finger" x={stringX(index)} y={dotY(fret)}>{voicing.fingers[index]}</text>
      {/if}
    {/if}
  {/each}
</svg>

<style>
  svg {
    display: block;
    overflow: visible;
  }

  .string,
  .fret {
    stroke: var(--line-strong);
    stroke-width: 1;
  }

  .nut {
    stroke: var(--line-strong);
    stroke-width: 1;
  }

  /* A pestana grossa é o que diz "esta forma está na primeira casa". */
  .nut.open {
    stroke: var(--ink);
    stroke-width: 4;
    stroke-linecap: square;
  }

  .dot,
  .barre {
    fill: var(--ink);
    stroke: var(--ink);
  }

  .barre {
    stroke-width: 18;
    stroke-linecap: round;
  }

  .open {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.5;
  }

  .muted line {
    stroke: var(--ink-dim);
    stroke-width: 1.5;
    stroke-linecap: round;
  }

  .finger {
    fill: var(--ground);
    font-size: 11px;
    font-weight: 600;
    text-anchor: middle;
    dominant-baseline: central;
  }

  .base-fret {
    fill: var(--ink-dim);
    font-size: 12px;
    text-anchor: end;
    dominant-baseline: central;
  }
</style>
