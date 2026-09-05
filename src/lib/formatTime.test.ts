import { describe, expect, it } from "vitest";

import { formatTime } from "./formatTime";

describe("formatTime", () => {
  it("formata minutos e segundos", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(9)).toBe("0:09");
    expect(formatTime(75)).toBe("1:15");
    expect(formatTime(157.2)).toBe("2:37");
  });

  it("trunca frações em vez de arredondar", () => {
    // Arredondar faria o relógio mostrar o segundo seguinte antes da hora.
    expect(formatTime(9.99)).toBe("0:09");
  });

  it("inclui horas somente quando existem", () => {
    expect(formatTime(3599)).toBe("59:59");
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(3661)).toBe("1:01:01");
  });

  it("devolve zero para entrada inutilizável", () => {
    // A duração é NaN enquanto os metadados do arquivo não chegaram.
    expect(formatTime(Number.NaN)).toBe("0:00");
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe("0:00");
    expect(formatTime(-5)).toBe("0:00");
  });
});
