import { describe, expect, it } from "vitest";

import { LatestRequest } from "./latestRequest";

describe("LatestRequest", () => {
  it("aceita a resposta do último pedido", () => {
    const requests = new LatestRequest();
    const ticket = requests.next();
    expect(requests.settle(ticket)).toBe(true);
  });

  it("descarta resposta superada por um pedido mais novo", () => {
    // O caso real: resposta lenta da consulta antiga chegando depois da nova.
    const requests = new LatestRequest();
    const first = requests.next();
    const second = requests.next();
    expect(requests.settle(first)).toBe(false);
    expect(requests.settle(second)).toBe(true);
  });

  it("descarta resposta fora de ordem mesmo chegando por último", () => {
    const requests = new LatestRequest();
    const first = requests.next();
    const second = requests.next();
    expect(requests.settle(second)).toBe(true);
    expect(requests.settle(first)).toBe(false);
  });

  it("sabe quando ainda há pedido em voo", () => {
    const requests = new LatestRequest();
    expect(requests.pending).toBe(false);
    const ticket = requests.next();
    expect(requests.pending).toBe(true);
    requests.settle(ticket);
    expect(requests.pending).toBe(false);
  });

  it("continua pendente enquanto só respostas velhas chegam", () => {
    const requests = new LatestRequest();
    const first = requests.next();
    requests.next();
    requests.settle(first);
    expect(requests.pending).toBe(true);
  });
});
