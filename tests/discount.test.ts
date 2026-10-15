import { describe, expect, test } from "bun:test";

import { afterDiscount, discountAmount } from "../src/lib/discount";

describe("desconto", () => {
  test("em valor", () => {
    expect(discountAmount(300, { kind: "valor", value: 50 })).toBe(50);
    expect(afterDiscount(300, { kind: "valor", value: 50 })).toBe(250);
  });
  test("em porcentagem", () => {
    expect(afterDiscount(250, { kind: "percent", value: 10 })).toBe(225);
    expect(afterDiscount(100, { kind: "percent", value: 12.5 })).toBe(87.5);
  });
  test("nunca passa do total", () => {
    expect(afterDiscount(80, { kind: "valor", value: 500 })).toBe(0);
    expect(afterDiscount(80, { kind: "percent", value: 400 })).toBe(0);
  });
  test("sem desconto ou valor inválido", () => {
    expect(afterDiscount(80)).toBe(80);
    expect(afterDiscount(80, { kind: "valor", value: -5 })).toBe(80);
    expect(afterDiscount(0, { kind: "valor", value: 5 })).toBe(0);
  });
});
