import type { FaceZone } from "@/components/facemap/face-data";

/**
 * Mapas de corpo (abdômen e glúteo): silhuetas vetoriais e regiões para registrar procedimentos, no mesmo
 * modelo do mapa facial. Os ids das regiões levam o nome do mapa (`abdomen:flanco-dir`), assim o registro das
 * clientes continua na mesma tabela e o que não tem prefixo segue sendo o rosto.
 *
 * LATERALIDADE: -dir e -esq seguem a anatomia da cliente. No abdômen (vista frontal) a direita dela aparece à
 * esquerda de quem olha; no glúteo (vista de costas) a direita dela aparece à direita de quem olha.
 */
export type BodyKind = "abdomen" | "gluteo";
export type MapKind = "rosto" | BodyKind;

export const MAP_LABELS: Record<MapKind, string> = {
  rosto: "Rosto",
  abdomen: "Abdômen",
  gluteo: "Glúteo",
};

export type BodyMapDef = {
  kind: BodyKind;
  label: string;
  viewBox: { width: number; height: number };
  /** Silhueta: preenchimento e recorte das regiões. */
  outline: string;
  /** Detalhes desenhados por cima (umbigo, linha média, dobras). */
  details: string[];
  zones: FaceZone[];
  /** Região do lado oposto (para "registrar também no lado oposto"). */
  pairs: Record<string, string>;
  /** Texto de ajuda e rótulos próprios do mapa. */
  hint: string;
  ariaLabel: string;
  procedures: string[];
  actions: string[];
};

/** Retângulo de cantos arredondados como caminho (as regiões são recortadas pela silhueta). */
const rr = (x: number, y: number, w: number, h: number, r = 22) =>
  `M${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x + r} Q${x},${y + h} ${x},${y + h - r} V${y + r} Q${x},${y} ${x + r},${y} Z`;

const zone = (
  kind: BodyKind,
  slug: string,
  nome: string,
  x: number,
  y: number,
  w: number,
  h: number,
): FaceZone => ({
  id: `${kind}:${slug}`,
  nome,
  c: [Math.round(x + w / 2), Math.round(y + h / 2)],
  d: rr(x + 3, y + 3, w - 6, h - 6),
});

const pairUp = (kind: BodyKind, slugs: [string, string][]) =>
  Object.fromEntries(
    slugs.flatMap(([a, b]) => [
      [`${kind}:${a}`, `${kind}:${b}`],
      [`${kind}:${b}`, `${kind}:${a}`],
    ]),
  );

// ---------------------------------------------------------------- abdômen (vista frontal)
const A = "abdomen" as const;
const ABDOMEN: BodyMapDef = {
  kind: A,
  label: "Abdômen",
  viewBox: { width: 600, height: 800 },
  outline:
    "M150,60 L450,60 C462,150 470,230 440,330 C416,410 480,480 486,560 C490,640 470,720 440,770 L360,770 C330,740 315,730 300,730 C285,730 270,740 240,770 L160,770 C130,720 110,640 114,560 C120,480 184,410 160,330 C130,230 138,150 150,60 Z",
  details: [
    "M150,150 C210,215 255,235 300,238 C345,235 390,215 450,150",
    "M300,96 L300,300",
    "M300,350 L300,560",
    "M165,575 C215,610 262,665 300,730",
    "M435,575 C385,610 338,665 300,730",
  ],
  zones: [
    zone(A, "hipocondrio-dir", "Hipocôndrio direito", 96, 56, 126, 180),
    zone(A, "epigastrio", "Epigástrio", 222, 56, 156, 180),
    zone(A, "hipocondrio-esq", "Hipocôndrio esquerdo", 378, 56, 126, 180),
    zone(A, "flanco-dir", "Flanco direito", 96, 236, 126, 174),
    zone(A, "umbilical", "Região umbilical", 222, 236, 156, 174),
    zone(A, "flanco-esq", "Flanco esquerdo", 378, 236, 126, 174),
    zone(A, "fossa-iliaca-dir", "Fossa ilíaca direita", 96, 410, 126, 190),
    zone(A, "hipogastrio", "Hipogástrio", 222, 410, 156, 190),
    zone(A, "fossa-iliaca-esq", "Fossa ilíaca esquerda", 378, 410, 126, 190),
  ],
  pairs: pairUp(A, [
    ["hipocondrio-dir", "hipocondrio-esq"],
    ["flanco-dir", "flanco-esq"],
    ["fossa-iliaca-dir", "fossa-iliaca-esq"],
  ]),
  hint: "Toque em uma das 9 regiões do abdômen.",
  ariaLabel: "Mapa do abdômen, vista frontal",
  procedures: [
    "Criolipólise",
    "Radiofrequência corporal",
    "Ultrassom cavitacional",
    "Massagem modeladora",
    "Drenagem linfática",
    "Carboxiterapia",
    "Endermoterapia",
  ],
  actions: [
    "Aplicação de ativo",
    "Assepsia",
    "Manobra de massagem",
    "Aplicação de equipamento",
    "Fotografia de acompanhamento",
    "Orientação de cuidado em casa",
  ],
};

// ---------------------------------------------------------------- glúteo (vista de costas)
const G = "gluteo" as const;
const GLUTEO: BodyMapDef = {
  kind: G,
  label: "Glúteo",
  viewBox: { width: 600, height: 800 },
  outline:
    "M170,60 L430,60 C452,130 450,220 470,300 C500,380 520,450 500,540 C490,640 480,720 470,780 L330,780 C322,700 312,640 300,600 C288,640 278,700 270,780 L130,780 C120,720 110,640 100,540 C80,450 100,380 130,300 C150,220 148,130 170,60 Z",
  details: [
    "M300,70 C300,150 300,250 300,330",
    "M300,330 C296,430 304,520 300,598",
    "M120,548 C200,574 270,570 300,558",
    "M480,548 C400,574 330,570 300,558",
    "M270,250 m-4,0 a4,4 0 1,0 8,0 a4,4 0 1,0 -8,0",
    "M330,250 m-4,0 a4,4 0 1,0 8,0 a4,4 0 1,0 -8,0",
  ],
  zones: [
    zone(G, "lombar-esq", "Região lombar esquerda", 97, 60, 200, 176),
    zone(G, "lombar-dir", "Região lombar direita", 303, 60, 200, 176),
    zone(G, "gluteo-sup-esq", "Glúteo superior esquerdo", 147, 236, 150, 164),
    zone(G, "gluteo-sup-dir", "Glúteo superior direito", 303, 236, 150, 164),
    zone(G, "gluteo-inf-esq", "Glúteo inferior esquerdo", 147, 400, 150, 148),
    zone(G, "gluteo-inf-dir", "Glúteo inferior direito", 303, 400, 150, 148),
    zone(G, "culote-esq", "Lateral do quadril esquerdo", 58, 300, 86, 250),
    zone(G, "culote-dir", "Lateral do quadril direito", 456, 300, 86, 250),
    zone(G, "sulco-esq", "Sulco subglúteo esquerdo", 147, 548, 150, 58),
    zone(G, "sulco-dir", "Sulco subglúteo direito", 303, 548, 150, 58),
    zone(G, "coxa-esq", "Coxa posterior esquerda", 97, 608, 200, 172),
    zone(G, "coxa-dir", "Coxa posterior direita", 303, 608, 200, 172),
  ],
  pairs: pairUp(G, [
    ["lombar-esq", "lombar-dir"],
    ["gluteo-sup-esq", "gluteo-sup-dir"],
    ["gluteo-inf-esq", "gluteo-inf-dir"],
    ["culote-esq", "culote-dir"],
    ["sulco-esq", "sulco-dir"],
    ["coxa-esq", "coxa-dir"],
  ]),
  hint: "Toque em uma das 12 regiões do glúteo.",
  ariaLabel: "Mapa do glúteo, vista de costas",
  procedures: [
    "Massagem modeladora",
    "Endermoterapia",
    "Radiofrequência corporal",
    "Carboxiterapia",
    "Criolipólise",
    "Microagulhamento corporal",
    "Drenagem linfática",
  ],
  actions: [
    "Aplicação de ativo",
    "Assepsia",
    "Manobra de massagem",
    "Aplicação de equipamento",
    "Fotografia de acompanhamento",
    "Orientação de cuidado em casa",
  ],
};

export const BODY_MAPS: Record<BodyKind, BodyMapDef> = { abdomen: ABDOMEN, gluteo: GLUTEO };

/** De qual mapa de corpo é esta região (`undefined`: é do rosto). */
export function bodyKindOf(zoneId: string): BodyKind | undefined {
  const prefix = zoneId.split(":")[0];
  return prefix === "abdomen" || prefix === "gluteo" ? prefix : undefined;
}

/** Qual mapa mostra esta marcação. */
export const mapKindOf = (zoneId: string): MapKind => bodyKindOf(zoneId) ?? "rosto";

export function bodyZone(zoneId: string): FaceZone | null {
  const kind = bodyKindOf(zoneId);
  return kind ? (BODY_MAPS[kind].zones.find((item) => item.id === zoneId) ?? null) : null;
}

export const bodyName = (zoneId: string): string | null => bodyZone(zoneId)?.nome ?? null;
