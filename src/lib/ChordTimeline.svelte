<script lang="ts">
  import { chordsInWindow, isSilence, scrollOffset } from "./chordTimeline";
  import type { TimedChord } from "./types";

  interface Props {
    chords: readonly TimedChord[];
    currentTime: number;
    /** Escala da faixa. Mais pixels por segundo, mais espaçados os acordes. */
    pixelsPerSecond?: number;
    onSeek?: (seconds: number) => void;
  }

  const { chords, currentTime, pixelsPerSecond = 90, onSeek }: Props = $props();

  /** Fração da largura em que o marcador fica. Deixa espaço à esquerda para o
   * acorde que acabou de passar, e a maior parte à direita para o que vem. */
  const PLAYHEAD_RATIO = 0.3;
  const SECONDS_BEHIND = 4;
  const SECONDS_AHEAD = 16;

  let width = $state(0);

  const playheadOffset = $derived(width * PLAYHEAD_RATIO);
  const offset = $derived(scrollOffset(currentTime, pixelsPerSecond, playheadOffset));
  const visible = $derived(
    chordsInWindow(chords, currentTime - SECONDS_BEHIND, currentTime + SECONDS_AHEAD),
  );

  function seekFromClick(event: MouseEvent) {
    if (onSeek === undefined) return;
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - bounds.left;
    onSeek((x - playheadOffset) / pixelsPerSecond + currentTime);
  }
</script>

<div
  class="timeline"
  bind:clientWidth={width}
  onclick={seekFromClick}
  onkeydown={undefined}
  role="presentation"
>
  <div class="track" style:transform="translateX({offset}px)">
    {#each visible as chord (chord.startSeconds)}
      {@const active = currentTime >= chord.startSeconds && currentTime < chord.endSeconds}
      <div
        class="chord"
        class:active
        class:silence={isSilence(chord)}
        style:left="{chord.startSeconds * pixelsPerSecond}px"
        style:width="{(chord.endSeconds - chord.startSeconds) * pixelsPerSecond}px"
      >
        <span>{isSilence(chord) ? "–" : chord.label}</span>
      </div>
    {/each}
  </div>
  <div class="playhead" style:left="{playheadOffset}px"></div>
</div>

<style>
  .timeline {
    position: relative;
    height: 5.5rem;
    overflow: hidden;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 16px;
    cursor: pointer;
  }

  .track {
    position: absolute;
    inset: 0;
    /* Sem transição: a posição vem do relógio do áudio a cada quadro, e
       interpolar por cima disso só atrasaria o acorde em relação ao som. */
  }

  .chord {
    position: absolute;
    top: 0.75rem;
    bottom: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 0.5rem;
    background: var(--surface-raised);
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    font-family: var(--serif);
    font-size: 1.4rem;
    font-weight: 400;
    overflow: hidden;
    white-space: nowrap;
  }

  .chord.active {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--ground);
  }

  .chord.silence {
    background: transparent;
    color: var(--ink-dim);
    font-weight: 400;
  }

  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--ink);
    opacity: 0.5;
    pointer-events: none;
  }
</style>
