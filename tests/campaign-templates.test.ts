import { describe, expect, test } from "bun:test";

import {
  CAMPAIGN_TEMPLATES,
  describeSegment,
  previewText,
  SEGMENT_LABEL,
  SEGMENT_PARAM,
  unknownVariables,
} from "../src/lib/campaign-templates";

describe("campanhas sugeridas", () => {
  test("cada sugestão é completa e cabe nos limites do banco", () => {
    expect(CAMPAIGN_TEMPLATES.length).toBeGreaterThanOrEqual(8);
    const ids = new Set<string>();
    for (const template of CAMPAIGN_TEMPLATES) {
      expect(ids.has(template.id)).toBe(false);
      ids.add(template.id);
      expect(template.title.length).toBeGreaterThan(0);
      expect(template.title.length).toBeLessThanOrEqual(60);
      expect(template.body.length).toBeLessThanOrEqual(200);
      expect(template.everyDays).toBeGreaterThanOrEqual(1);
      expect(template.everyDays).toBeLessThanOrEqual(365);
      expect(["/cliente", "/cliente/agenda", "/cliente/conquistas", "/cliente/evolucao"]).toContain(
        template.href,
      );
      expect(SEGMENT_LABEL[template.segment.type]).toBeTruthy();
    }
  });

  test("só usam variáveis que o servidor conhece", () => {
    for (const template of CAMPAIGN_TEMPLATES)
      expect(unknownVariables(`${template.title} ${template.body}`)).toEqual([]);
    expect(unknownVariables("Oi {nome} {nomee} {x}")).toEqual(["{nomee}", "{x}"]);
  });

  test("o parâmetro do segmento tem valor inicial dentro do mínimo", () => {
    for (const template of CAMPAIGN_TEMPLATES) {
      const param = SEGMENT_PARAM[template.segment.type];
      if (param.field) expect(template.segment[param.field]).toBeGreaterThanOrEqual(param.min);
    }
  });

  test("prévia troca as variáveis e descrição do público fala português", () => {
    expect(previewText("{nome}, faltam {faltam} para {premio}")).toBe(
      "Maria, faltam 30 para Desconto de R$ 30",
    );
    expect(describeSegment({ type: "inactive", days: 60, points: 0 })).toBe(
      "Sem atendimento há 60+ dias e sem horário marcado",
    );
    expect(describeSegment({ type: "all", days: 0, points: 0 })).toBe(
      "Todas as clientes com o app",
    );
  });
});
