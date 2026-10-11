import { describe, expect, test } from "bun:test";

import {
  BODY_MAPS,
  bodyKindOf,
  bodyName,
  bodyZone,
  mapKindOf,
  type BodyKind,
} from "../src/components/facemap/body-data";

const kinds = Object.keys(BODY_MAPS) as BodyKind[];

describe("mapas de corpo", () => {
  test("cada mapa tem regiões com id próprio do mapa, nome e centro dentro da silhueta", () => {
    for (const kind of kinds) {
      const def = BODY_MAPS[kind];
      expect(def.zones.length).toBeGreaterThanOrEqual(9);
      const ids = def.zones.map((zone) => zone.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const zone of def.zones) {
        expect(zone.id.startsWith(`${kind}:`)).toBe(true);
        expect(zone.nome.length).toBeGreaterThan(3);
        expect(zone.d.startsWith("M")).toBe(true);
        const [x, y] = zone.c ?? [-1, -1];
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(def.viewBox.width);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(def.viewBox.height);
      }
    }
  });

  test("pares do lado oposto são simétricos e apontam para regiões que existem", () => {
    for (const kind of kinds) {
      const def = BODY_MAPS[kind];
      const ids = new Set(def.zones.map((zone) => zone.id));
      for (const [a, b] of Object.entries(def.pairs)) {
        expect(ids.has(a)).toBe(true);
        expect(ids.has(b)).toBe(true);
        expect(def.pairs[b]).toBe(a);
        expect(a.endsWith("-dir") ? b.endsWith("-esq") : b.endsWith("-dir")).toBe(true);
      }
    }
  });

  test("a direita da cliente: no abdômen aparece à esquerda da tela, no glúteo (costas) à direita", () => {
    const x = (kind: BodyKind, id: string) => bodyZone(`${kind}:${id}`)!.c![0];
    expect(x("abdomen", "flanco-dir")).toBeLessThan(x("abdomen", "flanco-esq"));
    expect(x("gluteo", "gluteo-sup-dir")).toBeGreaterThan(x("gluteo", "gluteo-sup-esq"));
  });

  test("ids sem prefixo continuam sendo do rosto", () => {
    expect(bodyKindOf("testa")).toBeUndefined();
    expect(mapKindOf("testa")).toBe("rosto");
    expect(mapKindOf("abdomen:flanco-dir")).toBe("abdomen");
    expect(mapKindOf("gluteo:coxa-esq")).toBe("gluteo");
    expect(bodyName("abdomen:umbilical")).toBe("Região umbilical");
    expect(bodyName("testa")).toBeNull();
  });
});
