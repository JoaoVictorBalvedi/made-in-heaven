<script lang="ts">
  import type { DiscPalette } from "./discPalette";

  interface Props {
    palette: DiscPalette | null;
    /** Intensidade entre 0 e 1, vinda da troca de acorde. */
    pulse?: number;
  }

  const { palette, pulse = 0 }: Props = $props();

  /** Brilho de repouso: o fundo respira mesmo com a música parada. */
  const FLOOR = 0.4;
  const RANGE = 0.6;

  const intensity = $derived(FLOOR + pulse * RANGE);
</script>

{#if palette}
  <div
    class="glow"
    aria-hidden="true"
    style:--tint={palette.groove}
    style:--deep={palette.sheen}
    style:--intensity={intensity}
    style:--spread="{104 + pulse * 18}%"
  ></div>
{/if}

<style>
  .glow {
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    opacity: var(--intensity);
    /* Duas fontes de luz em cantos opostos: uma só, centrada, lê como
       vinheta invertida em vez de ambiente. */
    background:
      radial-gradient(
        var(--spread) 86% at 16% -6%,
        color-mix(in oklab, var(--tint) 72%, transparent),
        transparent 72%
      ),
      radial-gradient(
        var(--spread) 80% at 90% 106%,
        color-mix(in oklab, var(--deep) 88%, transparent),
        transparent 70%
      );
    /* A transição alcança o piso entre um acorde e outro, então o fundo
       pulsa em vez de piscar. */
    transition: opacity 220ms ease-out, background 400ms linear;
  }

  @media (prefers-reduced-motion: reduce) {
    .glow {
      opacity: 0.4;
      transition: none;
    }
  }
</style>
