import { describe, expect, test } from "bun:test";

import { buildMarks, emptyRecord, productLabel, summarizeMark } from "../src/lib/face-map-store";
import { addProductUse } from "../src/services/sessions.service";

const stock = [
  { id: "s1", name: "Ácido", cost: 42.5 },
  { id: "s2", name: "Máscara", cost: 8 },
];

describe("produto no registro do mapa", () => {
  test("rótulo: com quantidade, sem produto, marca antiga e vazio", () => {
    expect(productLabel({ produto: "Ácido", usouProduto: true, produtoQtd: 2 })).toBe("Ácido ×2");
    expect(productLabel({ produto: "Ácido", usouProduto: true, produtoQtd: 1 })).toBe("Ácido");
    expect(productLabel({ produto: "", usouProduto: false })).toBe("Sem produto");
    expect(productLabel({ produto: "Máscara" })).toBe("Máscara"); // marca antiga
    expect(productLabel({ produto: "" })).toBe("");
  });

  test("resumo junta procedimento, produto e ação", () => {
    expect(
      summarizeMark({
        ...emptyRecord,
        procedimento: "Peeling",
        produto: "Ácido",
        usouProduto: true,
        produtoQtd: 2,
        acao: "Aplicação",
      }),
    ).toBe("Peeling · Ácido ×2 · Aplicação");
  });

  test("a marcação guarda produtoId e quantidade, e o espelho leva o mesmo registro", () => {
    const marks = buildMarks(
      "abdomen:flanco-dir",
      { ...emptyRecord, produto: "Ácido", usouProduto: true, produtoId: "s1", produtoQtd: 2 },
      [],
      "abdomen:flanco-esq",
    );
    expect(marks.map((mark) => mark.zoneId)).toEqual(["abdomen:flanco-dir", "abdomen:flanco-esq"]);
    expect(marks.every((mark) => mark.produtoId === "s1" && mark.produtoQtd === 2)).toBe(true);
  });
});

describe("produto do mapa entra nos produtos do atendimento", () => {
  test("novo item com nome e custo do estoque", () => {
    expect(addProductUse([], stock, "s1", 2)).toEqual([
      { stockId: "s1", name: "Ácido", qty: 2, unitCost: 42.5 },
    ]);
  });
  test("já marcado: fica a maior quantidade, sem duplicar", () => {
    const current = [{ stockId: "s1", name: "Ácido", qty: 3, unitCost: 42.5 }];
    expect(addProductUse(current, stock, "s1", 1)).toBe(current);
    expect(addProductUse(current, stock, "s1", 5)[0]?.qty).toBe(5);
    expect(addProductUse(current, stock, "s1", 5).length).toBe(1);
  });
  test("produto que não existe ou quantidade inválida não muda nada", () => {
    const current = [{ stockId: "s2", name: "Máscara", qty: 1, unitCost: 8 }];
    expect(addProductUse(current, stock, "x", 1)).toBe(current);
    expect(addProductUse(current, stock, "s1", 0)).toBe(current);
  });
});
