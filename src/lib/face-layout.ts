import { useEffect, useMemo, useState } from "react";

import { FACE_PAIRS, FACE_ZONES, type FaceZone } from "@/components/facemap/face-data";
import {
  centroid,
  mirrorShape,
  NEUTRAL,
  pointsOf,
  transformedPath,
  transformOf,
  transformPoint,
  type Pt,
  type Shape,
} from "@/lib/face-geometry";

/**
 * Layout do mapa facial da clínica: formas ajustadas, regiões criadas, renomeações,
 * regiões ocultas e os padrões salvos. Fica no aparelho enquanto não há banco; trocar
 * por backend não muda as telas.
 */
export type LayoutPack = {
  formas: Record<string, Shape>;
  novas: FaceZone[];
  nomes: Record<string, string>;
  ocultas: string[];
};
export type LayoutPreset = LayoutPack & { id: string; nome: string };

const PACK_KEY = "eb-mapa-facial-formas-v1";
const PRESETS_KEY = "eb-mapa-facial-padroes-v1";
const CHANGED = "eb-face-layout-changed";

export const emptyPack = (): LayoutPack => ({ formas: {}, novas: [], nomes: {}, ocultas: [] });

export function readPack(): LayoutPack | null {
  try {
    const raw = window.localStorage.getItem(PACK_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) ?? {};
    const pack = data.formas || data.novas || data.nomes ? data : { formas: data };
    return {
      formas: pack.formas ?? {},
      novas: pack.novas ?? [],
      nomes: pack.nomes ?? {},
      ocultas: pack.ocultas ?? [],
    };
  } catch {
    return null;
  }
}

export function writePack(pack: LayoutPack): boolean {
  try {
    window.localStorage.setItem(PACK_KEY, JSON.stringify(pack));
    window.dispatchEvent(new Event(CHANGED));
    return true;
  } catch {
    return false;
  }
}

export function readPresets(): LayoutPreset[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(PRESETS_KEY) ?? "null");
    return Array.isArray(list) ? (list as LayoutPreset[]) : [];
  } catch {
    return [];
  }
}

export function writePresets(list: LayoutPreset[]) {
  try {
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
  } catch {
    /* sem armazenamento */
  }
}

/** Região visível, com o ajuste de forma, o nome e a máscara das microrregiões já resolvidos. */
export type ResolvedLayout = {
  zones: FaceZone[];
  transforms: Record<string, string>;
  masks: Record<string, string>;
  nameOf: (id: string) => string;
  zoneById: (id: string) => FaceZone | null;
  pairOf: (id: string) => string | null;
  /** Onde a marcação pousa quando não há ponto escolhido: o centro da região, já com o ajuste. */
  anchorOf: (id: string) => Pt | null;
};

export function resolveLayout(pack: LayoutPack | null): ResolvedLayout {
  const p = pack ?? emptyPack();
  const zones = [...FACE_ZONES, ...p.novas].filter((zone) => !p.ocultas.includes(zone.id));
  const byId = new Map(zones.map((zone) => [zone.id, zone]));

  const transforms: Record<string, string> = {};
  for (const zone of zones) {
    const t = transformOf(zone.d, p.formas[zone.id]);
    if (t) transforms[zone.id] = t;
  }

  const masks: Record<string, string> = {};
  for (const zone of zones) {
    const children = p.novas.filter((nova) => nova.mae === zone.id);
    if (children.length)
      masks[zone.id] = children
        .map((child) => transformedPath(child.d, p.formas[child.id]))
        .join(" ");
  }

  return {
    zones,
    transforms,
    masks,
    nameOf: (id) =>
      p.nomes[id] ?? byId.get(id)?.nome ?? FACE_ZONES.find((zone) => zone.id === id)?.nome ?? id,
    zoneById: (id) => byId.get(id) ?? null,
    pairOf: (id) => FACE_PAIRS[id] ?? byId.get(id)?.par ?? null,
    anchorOf: (id) => {
      const zone = byId.get(id);
      if (!zone) return null;
      const base = zone.c ? { x: zone.c[0], y: zone.c[1] } : centroid(pointsOf(zone.d));
      return transformPoint(base, zone.d, p.formas[id]);
    },
  };
}

/** O layout salvo, atualizado quando o editor grava ou quando outra aba muda. */
export function useFaceLayout(): ResolvedLayout {
  const [pack, setPack] = useState<LayoutPack | null>(null);

  useEffect(() => {
    const refresh = () => setPack(readPack());
    refresh();
    window.addEventListener(CHANGED, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHANGED, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return useMemo(() => resolveLayout(pack), [pack]);
}

export { mirrorShape, NEUTRAL };
