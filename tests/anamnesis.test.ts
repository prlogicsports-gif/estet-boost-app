import { describe, expect, test } from "bun:test";

import {
  DEFAULT_QUESTIONS,
  formatAnswer,
  hasAnswer,
  missingRequired,
  normalizeQuestion,
  normalizeQuestions,
} from "../src/lib/anamnesis";

describe("anamnese", () => {
  test("modelo antigo (sem tipo) vira texto longo", () => {
    expect(normalizeQuestion({ id: "a", label: "Alergias" })).toEqual({
      id: "a",
      label: "Alergias",
      type: "longtext",
    });
    expect(normalizeQuestions(undefined)).toEqual([]);
  });

  test("tipo desconhecido volta para texto longo e opções só valem em perguntas de escolha", () => {
    expect(normalizeQuestion({ id: "a", label: "x", type: "foto" as never }).type).toBe("longtext");
    const text = normalizeQuestion({ id: "b", label: "y", type: "text", options: ["a"] });
    expect(text.options).toBeUndefined();
    const single = normalizeQuestion({
      id: "c",
      label: "z",
      type: "single",
      options: [" Seca ", "", "Oleosa"],
    });
    expect(single.options).toEqual(["Seca", "Oleosa"]);
  });

  test("respostas: lista, texto, vazio e data", () => {
    expect(formatAnswer({ id: "m", label: "m", type: "multi" }, ["Manchas", "Acne"])).toBe(
      "Manchas, Acne",
    );
    expect(formatAnswer({ id: "d", label: "d", type: "date" }, "2026-10-09")).toBe("09/10/2026");
    expect(formatAnswer({ id: "t", label: "t", type: "text" }, "")).toBe("—");
    expect(hasAnswer([])).toBe(false);
    expect(hasAnswer(["  "])).toBe(false);
    expect(hasAnswer("Sim")).toBe(true);
  });

  test("obrigatórias sem resposta", () => {
    const questions = [
      { id: "a", label: "A", required: true },
      { id: "b", label: "B", required: true },
      { id: "c", label: "C" },
    ];
    expect(missingRequired(questions, { a: "ok" }).map((q) => q.id)).toEqual(["b"]);
    expect(missingRequired(questions, { a: "ok", b: ["x"] })).toEqual([]);
  });

  test("padrão da clínica tem alerta em alergias", () => {
    expect(DEFAULT_QUESTIONS.find((q) => q.id === "alergias")?.flag).toBe(true);
    expect(DEFAULT_QUESTIONS.length).toBe(7);
  });
});
