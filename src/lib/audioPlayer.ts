/** Reprodução de áudio e o relógio que a interface acompanha.
 *
 * Toda a interface lê a posição por aqui. Trocar o motor de reprodução por
 * baixo — por exemplo, ao chegar a mistura de stems — não deve exigir mudança
 * em nenhum componente.
 */

export type TimeListener = (currentTime: number) => void;

export class AudioPlayer {
  readonly #element = new Audio();
  readonly #listeners = new Set<TimeListener>();
  #frame: number | null = null;

  constructor() {
    this.#element.preload = "auto";
    // `ended` não dispara mais quadros; a posição final precisa ser publicada.
    this.#element.addEventListener("ended", () => this.#publish());
  }

  /** Carrega uma faixa e resolve quando a duração já é conhecida. */
  load(mediaUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const onReady = () => {
        cleanup();
        this.#publish();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("não foi possível carregar este arquivo de áudio"));
      };
      const cleanup = () => {
        this.#element.removeEventListener("loadedmetadata", onReady);
        this.#element.removeEventListener("error", onError);
      };
      this.#element.addEventListener("loadedmetadata", onReady);
      this.#element.addEventListener("error", onError);
      this.#element.src = mediaUrl;
      this.#element.load();
    });
  }

  async play(): Promise<void> {
    await this.#element.play();
    this.#startTicking();
  }

  pause(): void {
    this.#element.pause();
    this.#stopTicking();
    this.#publish();
  }

  seek(seconds: number): void {
    const bounded = Math.min(Math.max(seconds, 0), this.duration || 0);
    this.#element.currentTime = bounded;
    this.#publish();
  }

  get playing(): boolean {
    return !this.#element.paused && !this.#element.ended;
  }

  get duration(): number {
    return Number.isFinite(this.#element.duration) ? this.#element.duration : 0;
  }

  get currentTime(): number {
    return this.#element.currentTime;
  }

  /** Observa a posição. Devolve a função que cancela a inscrição. */
  onTime(listener: TimeListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  destroy(): void {
    this.#stopTicking();
    this.#listeners.clear();
    this.#element.pause();
    this.#element.src = "";
  }

  // A posição é lida por quadro de vídeo, não por intervalo de tempo: é o que
  // mantém o acorde na tela alinhado com o que se ouve, sem tremor.
  #startTicking(): void {
    if (this.#frame !== null) return;
    const tick = () => {
      this.#publish();
      this.#frame = this.playing ? requestAnimationFrame(tick) : null;
    };
    this.#frame = requestAnimationFrame(tick);
  }

  #stopTicking(): void {
    if (this.#frame === null) return;
    cancelAnimationFrame(this.#frame);
    this.#frame = null;
  }

  #publish(): void {
    for (const listener of this.#listeners) listener(this.#element.currentTime);
  }
}
