/** Descarta resposta de pedido que já foi superado por outro.
 *
 * Busca enquanto se digita dispara pedidos em sequência, e eles não voltam
 * necessariamente na ordem em que saíram: sem isto, uma resposta antiga e lenta
 * sobrescreve na tela o resultado da consulta mais recente.
 */
export class LatestRequest {
  #issued = 0;
  #settled = 0;

  /** Registra um novo pedido e devolve o seu número de ordem. */
  next(): number {
    this.#issued += 1;
    return this.#issued;
  }

  /** A resposta deste pedido ainda vale, ou já foi superada? */
  isCurrent(ticket: number): boolean {
    return ticket === this.#issued;
  }

  /** Marca a resposta como aplicada. Devolve `false` se ela já estava velha. */
  settle(ticket: number): boolean {
    if (!this.isCurrent(ticket)) return false;
    this.#settled = ticket;
    return true;
  }

  /** Há pedido em voo cuja resposta ainda não foi aplicada? */
  get pending(): boolean {
    return this.#issued !== this.#settled;
  }
}
