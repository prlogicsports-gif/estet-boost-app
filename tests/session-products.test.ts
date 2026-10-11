import { describe, expect, test } from "bun:test";

import { mergeProductLists, productsFrom } from "../src/services/sessions.service";

const stock = [
  { id: "s1", name: "Ácido", cost: 42.5 },
  { id: "s2", name: "Máscara", cost: 8 },
];

describe("produtos do procedimento no atendimento", () => {
  test("traz nome e custo do estoque e ignora produto que sumiu ou quantidade zero", () => {
    const procedure = {
      products: [
        { stockId: "s1", qty: 2 },
        { stockId: "s9", qty: 1 },
        { stockId: "s2", qty: 0 },
      ],
    };
    expect(productsFrom(stock, procedure)).toEqual([
      { stockId: "s1", name: "Ácido", qty: 2, unitCost: 42.5 },
    ]);
    expect(productsFrom(stock, undefined)).toEqual([]);
  });

  test("mesclar não duplica e mantém a quantidade já marcada", () => {
    const current = [{ stockId: "s1", name: "Ácido", qty: 5, unitCost: 42.5 }];
    const extra = productsFrom(stock, {
      products: [
        { stockId: "s1", qty: 2 },
        { stockId: "s2", qty: 1 },
      ],
    });
    const merged = mergeProductLists(current, extra);
    expect(merged.map((item) => [item.stockId, item.qty])).toEqual([
      ["s1", 5],
      ["s2", 1],
    ]);
    expect(mergeProductLists(merged, extra)).toBe(merged);
  });
});
