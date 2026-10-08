/**
 * Geometria do mapa facial: funções puras, sem React e sem DOM. Os mesmos algoritmos
 * do padrão aprovado: caixa pelos números do próprio traçado, encaixe de valores
 * quase neutros, espelhamento e suavização.
 */
export type Pt = { x: number; y: number };
/** Ajuste de uma região por cima do desenho padrão. O padrão nunca é destruído. */
export type Shape = { dx: number; dy: number; sx: number; sy: number; rot: number };

export const NEUTRAL: Shape = { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0 };

/** Pontos de um polígono "Mx,y Lx,y … Z" (usa todos os números do traçado, curvas incluídas). */
export function pointsOf(d: string | undefined): Pt[] {
  const nums = (d ?? "")
    .replace(/[A-Za-z]/g, " ")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i];
    const y = nums[i + 1];
    if (x !== undefined && y !== undefined && Number.isFinite(x) && Number.isFinite(y))
      pts.push({ x, y });
  }
  return pts;
}

export function centroid(pts: Pt[]): Pt {
  const n = pts.length || 1;
  return {
    x: pts.reduce((acc, p) => acc + p.x, 0) / n,
    y: pts.reduce((acc, p) => acc + p.y, 0) / n,
  };
}

export function areaOf(pts: Pt[]): number {
  return Math.abs(
    pts.reduce((acc, p, i) => {
      const q = pts[(i + 1) % pts.length];
      return q ? acc + (p.x * q.y - q.x * p.y) : acc;
    }, 0) / 2,
  );
}

export function smooth(pts: Pt[]): Pt[] {
  return pts.map((p, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length] ?? p;
    const b = pts[(i + 1) % pts.length] ?? p;
    return { x: (a.x + p.x * 2 + b.x) / 4, y: (a.y + p.y * 2 + b.y) / 4 };
  });
}

/** Caixa geométrica: não depende de o DOM ter pintado. */
export function bbox(d: string | undefined): { x: number; y: number; w: number; h: number } | null {
  const pts = pointsOf(d);
  if (pts.length < 2) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x;
  const h = Math.max(...ys) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}

/** Encaixa valores quase neutros: nada fica a 1° ou 2px do lugar certo. */
export function snap(f: Shape): Shape {
  const q = (v: number, step: number) => Math.round(v / step) * step;
  const near = (v: number, target: number, tol: number) =>
    Math.abs(v - target) <= tol ? target : v;
  return {
    dx: near(q(f.dx, 1), 0, 2),
    dy: near(q(f.dy, 1), 0, 2),
    sx: near(q(f.sx, 0.01), f.sx < 0 ? -1 : 1, 0.03),
    sy: near(q(f.sy, 0.01), f.sy < 0 ? -1 : 1, 0.03),
    rot: near(q(f.rot, 0.5), 0, 1.5),
  };
}

export const mirrorShape = (f: Shape): Shape => ({
  dx: -f.dx,
  dy: f.dy,
  sx: f.sx,
  sy: f.sy,
  rot: -f.rot,
});

export const sameShape = (a: Shape, b: Shape) =>
  Math.abs(a.dx - b.dx) < 0.5 &&
  Math.abs(a.dy - b.dy) < 0.5 &&
  Math.abs(a.sx - b.sx) < 0.01 &&
  Math.abs(a.sy - b.sy) < 0.01 &&
  Math.abs(a.rot - b.rot) < 0.2;

export const isNeutral = (f: Shape) =>
  f.dx === 0 && f.dy === 0 && f.sx === 1 && f.sy === 1 && f.rot === 0;

/** String de transform em torno do centro da caixa. */
export function transformOf(d: string, shape: Partial<Shape> | undefined): string | null {
  const bb = bbox(d);
  if (!bb) return null;
  const f = { ...NEUTRAL, ...shape };
  if (isNeutral(f)) return null;
  const cx = bb.x + bb.w / 2;
  const cy = bb.y + bb.h / 2;
  return `translate(${cx + f.dx} ${cy + f.dy}) rotate(${f.rot}) scale(${f.sx} ${f.sy}) translate(${-cx} ${-cy})`;
}

/** Leva um ponto para onde o ajuste da região o colocou. */
export function transformPoint(p: Pt, d: string, shape: Partial<Shape> | undefined): Pt {
  const bb = bbox(d);
  const f = { ...NEUTRAL, ...shape };
  if (!bb) return p;
  const cx = bb.x + bb.w / 2;
  const cy = bb.y + bb.h / 2;
  const rad = (f.rot * Math.PI) / 180;
  const vx = (p.x - cx) * f.sx;
  const vy = (p.y - cy) * f.sy;
  return {
    x: cx + f.dx + vx * Math.cos(rad) - vy * Math.sin(rad),
    y: cy + f.dy + vx * Math.sin(rad) + vy * Math.cos(rad),
  };
}

/** Aplica a forma nos próprios pontos: usado para recortar a região-mãe. */
export function transformedPath(d: string, shape: Partial<Shape> | undefined): string {
  const pts = pointsOf(d);
  if (!pts.length) return "";
  if (!bbox(d)) return `M${pts.map((p) => `${p.x},${p.y}`).join(" L")} Z`;
  const moved = pts.map((p) => transformPoint(p, d, shape));
  return `M${moved.map((p) => `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`).join(" L")} Z`;
}

/** Polígono regular em torno do toque: quando o vão não pode ser lido. */
export function freeShape(cx: number, cy: number, radius: number): Pt[] {
  const N = 16;
  return Array.from({ length: N }, (_, i) => {
    const angle = (i / N) * Math.PI * 2;
    return {
      x: Math.round(cx + Math.cos(angle) * radius),
      y: Math.round(cy + Math.sin(angle) * radius * 0.86),
    };
  });
}

export function pathOfPoints(pts: Pt[] | undefined): string {
  if (!pts || !pts.length) return "";
  return `M${pts.map((p) => `${p.x},${p.y}`).join(" L")}${pts.length > 2 ? " Z" : ""}`;
}

/** Nome provável pela faixa do rosto e pelo lado (anatomia da cliente). */
export function likelyName(cx: number, cy: number): string {
  const bands: [number, number, string][] = [
    [0, 300, "Testa"],
    [300, 400, "Glabela"],
    [400, 500, "Sobrancelha"],
    [500, 560, "Região periorbital"],
    [560, 700, "Bochecha"],
    [700, 760, "Região perioral"],
    [760, 860, "Lábios"],
    [860, 950, "Mento"],
    [950, 1110, "Pescoço"],
  ];
  const base = bands.find((band) => cy >= band[0] && cy < band[1])?.[2] ?? "Região";
  if (Math.abs(cx - 427) < 46) return `${base} central`;
  // Convenção clínica: o lado esquerdo da imagem é a direita da cliente.
  return `${base}${cx < 427 ? " direita" : " esquerda"}`;
}
