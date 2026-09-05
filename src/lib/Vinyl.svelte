<script lang="ts">
  import { loadDiscPalette, type DiscPalette } from "./discPalette";

  interface Props {
    /** Capa do álbum. Sem ela, o disco fica com o rótulo liso. */
    coverUrl?: string | null;
    /** Posição da música, em segundos. É o que gira o disco. */
    currentTime?: number;
    size?: number;
  }

  const { coverUrl = null, currentTime = 0, size = 180 }: Props = $props();

  /** 33⅓ rotações por minuto — a velocidade de um LP de verdade. */
  const SECONDS_PER_TURN = 60 / (100 / 3);

  // O ângulo é função do tempo da música, não uma animação com vida própria.
  // Assim, pausar congela, arrastar para trás gira ao contrário e a rotação
  // nunca sai de sincronia com o que se ouve — nada disso precisa de código.
  const rotation = $derived(((currentTime / SECONDS_PER_TURN) * 360) % 360);

  /** Cor do disco quando não há capa de onde tirá-la. */
  const NEUTRAL: DiscPalette = { sheen: "#3a3a44", deep: "#08080a", groove: "#6a6a78" };
  let palette = $state<DiscPalette>(NEUTRAL);

  // O vinil reflete a luz e o que está em volta; aqui, a própria capa.
  $effect(() => {
    const url = coverUrl;
    if (url === null) {
      palette = NEUTRAL;
      return;
    }
    let current = true;
    void loadDiscPalette(url).then((found) => {
      if (current) palette = found ?? NEUTRAL;
    });
    return () => {
      current = false;
    };
  });

  /** Raios dos sulcos, do bordo até o rótulo. Espaçamento irregular de
   * propósito: sulco perfeitamente uniforme lê como grade, não como vinil. */
  const GROOVES = Array.from({ length: 26 }, (_, index) => 96 - index * 2.4);
  const LABEL_RADIUS = 34;
</script>

<div class="vinyl" style:--size="{size}px">
  <svg viewBox="-100 -100 200 200" aria-hidden="true" style:transform="rotate({rotation}deg)">
    <defs>
      <!-- O brilho não gira com o disco: é reflexo de luz, fica parado. -->
      <radialGradient id="sheen" cx="0.32" cy="0.24" r="0.85">
        <stop offset="0%" stop-color={palette.sheen} />
        <stop offset="38%" stop-color={palette.deep} stop-opacity="0.82" />
        <stop offset="100%" stop-color={palette.deep} />
      </radialGradient>
      <clipPath id="label-clip">
        <circle cx="0" cy="0" r={LABEL_RADIUS} />
      </clipPath>
    </defs>

    <circle class="disc" cx="0" cy="0" r="99" fill="url(#sheen)" />

    <g class="grooves">
      {#each GROOVES as radius, index}
        <circle
          cx="0"
          cy="0"
          r={radius}
          stroke={palette.groove}
          opacity={index % 4 === 0 ? 0.16 : 0.07}
        />
      {/each}
    </g>

    <g class="label">
      {#if coverUrl}
        <image
          href={coverUrl}
          x={-LABEL_RADIUS}
          y={-LABEL_RADIUS}
          width={LABEL_RADIUS * 2}
          height={LABEL_RADIUS * 2}
          preserveAspectRatio="xMidYMid slice"
          clip-path="url(#label-clip)"
        />
      {:else}
        <circle cx="0" cy="0" r={LABEL_RADIUS} class="blank-label" />
      {/if}
      <circle cx="0" cy="0" r={LABEL_RADIUS} class="label-ring" />
      <!-- Furo central: é o que faz o olho ler "disco" e não "moeda". -->
      <circle cx="0" cy="0" r="4.5" class="spindle" />
    </g>
  </svg>
</div>

<style>
  .vinyl {
    width: var(--size);
    height: var(--size);
    flex-shrink: 0;
    border-radius: 50%;
    /* Sombra projetada dá o volume que o gradiente sozinho não dá. */
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.55);
  }

  svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  @media (prefers-reduced-motion: reduce) {
    /* O disco fica parado, mas o resto da interface continua igual. */
    svg { transform: none !important; }
  }

  .grooves circle {
    fill: none;
    stroke-width: 0.5;
  }

  .blank-label { fill: var(--surface-raised); }

  .label-ring {
    fill: none;
    stroke: rgb(0 0 0 / 0.55);
    stroke-width: 1;
  }

  .spindle {
    fill: var(--ground);
    stroke: rgb(255 255 255 / 0.12);
    stroke-width: 0.75;
  }
</style>
