import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { Icon } from "@/components/eb/icon";
import { IconButton } from "@/components/eb/icon-button";
import { FACE_VIEWBOX, type FaceZone } from "@/components/facemap/face-data";
import { FaceMap } from "@/components/facemap/face-map";
import { FACE_MOLDS } from "@/components/facemap/face-molds";
import { Button } from "@/components/ui/button";
import {
  areaOf,
  bbox,
  centroid,
  freeShape,
  likelyName,
  mirrorShape,
  NEUTRAL,
  pathOfPoints,
  pointsOf,
  sameShape,
  smooth,
  snap,
  transformedPath,
  type Pt,
  type Shape,
} from "@/lib/face-geometry";
import {
  emptyPack,
  readPack,
  readPresets,
  resolveLayout,
  writePack,
  writePresets,
  type LayoutPack,
  type LayoutPreset,
} from "@/lib/face-layout";
import { cn } from "@/lib/utils";

/**
 * Editor de regiões do mapa facial. Arrastar move, as alças esticam, a alça nude gira,
 * os pares perguntam se replicam no lado oposto e novas regiões nascem tocando num vão
 * livre (a área é lida por varredura de raios) ou ponto a ponto. Cada conjunto de ajustes
 * pode ser salvo como um padrão nomeado. O desenho de referência nunca é destruído: os
 * ajustes são transformações por cima dele, então "Redefinir" sempre volta ao padrão.
 */
type Gesture = {
  id: string;
  mode: string;
  p0: Pt;
  f0: Shape;
  bb: { x: number; y: number; w: number; h: number };
  ang0: number;
  moved: boolean;
};

type Draft = { sx: number; sy: number; rot: number; folga: number };
const DRAFT0: Draft = { sx: 1, sy: 1, rot: 0, folga: 0 };

const label =
  "text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground";
const textField =
  "min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] px-3 text-[14.5px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Slider({
  label: text,
  shown,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  shown: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[11.5px] text-[var(--text-secondary)]">
        {text} <span className="font-mono text-muted-foreground">{shown}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={text}
        onChange={(event) => onChange(parseFloat(event.target.value))}
        className="h-6 w-full accent-[var(--teal)]"
      />
    </label>
  );
}

function Pill({
  on,
  children,
  onClick,
}: {
  on: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full px-2.5 text-[12.5px]",
        on
          ? "bg-[var(--eb-ivory-a10)] font-medium text-foreground"
          : "text-[var(--text-secondary)]",
      )}
    >
      {children}
    </button>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-card)] px-4 py-3.5"
      style={{ boxShadow: "var(--shadow-float)" }}
    >
      {children}
    </div>
  );
}

export function FaceMapEditor({ onExit }: { onExit?: () => void }) {
  const [formas, setFormas] = useState<Record<string, Shape>>({});
  const [novas, setNovas] = useState<FaceZone[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [ocultas, setOcultas] = useState<string[]>([]);
  const [padroes, setPadroes] = useState<LayoutPreset[]>([]);
  const [padraoAtivo, setPadraoAtivo] = useState<string | null>(null);
  const [sincronia, setSincronia] = useState<Record<string, boolean>>({});
  const [edicao, setEdicao] = useState<string | null>(null);
  const [perguntarPar, setPerguntarPar] = useState<string | null>(null);
  const [sugestao, setSugestao] = useState<{ id: string; nome: string } | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [desenhando, setDesenhando] = useState(false);
  const [modoDesenho, setModoDesenho] = useState<"auto" | "pontos">("auto");
  const [rascunho, setRascunho] = useState<Pt[]>([]);
  const [formaR, setFormaR] = useState<Draft>(DRAFT0);
  const [nomeNova, setNomeNova] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gesto = useRef<Gesture | null>(null);

  useEffect(() => {
    const pack = readPack();
    if (pack) {
      setFormas(pack.formas);
      setNovas(pack.novas);
      setNomes(pack.nomes);
      setOcultas(pack.ocultas);
    }
    setPadroes(readPresets());
  }, []);

  const pack: LayoutPack = useMemo(
    () => ({ formas, novas, nomes, ocultas }),
    [formas, novas, nomes, ocultas],
  );
  const layout = useMemo(() => resolveLayout(pack), [pack]);
  const lista = layout.zones;
  const zonaEd = edicao ? layout.zoneById(edicao) : null;
  const nomeDe = (z: FaceZone | null) => (z ? layout.nameOf(z.id) : "");
  const forma = (id: string): Shape => ({ ...NEUTRAL, ...(formas[id] ?? {}) });

  // Os gestos de arrastar rodam em ouvintes da janela: leem sempre o estado mais novo por aqui.
  const live = useRef({ formas, sincronia, layout, novas });
  live.current = { formas, sincronia, layout, novas };

  function aplicarForma(id: string, parcial: Partial<Shape>) {
    setFormas((atual) => {
      const nova = snap({ ...NEUTRAL, ...(atual[id] ?? {}), ...parcial });
      const out = { ...atual, [id]: nova };
      const par = live.current.layout.pairOf(id);
      if (par) {
        if (live.current.sincronia[id]) {
          out[par] = mirrorShape(nova);
          setPerguntarPar(null);
        } else {
          const atualPar = { ...NEUTRAL, ...(atual[par] ?? {}) };
          setPerguntarPar(sameShape(mirrorShape(nova), atualPar) ? null : id);
        }
      }
      return out;
    });
    setSalvo(false);
  }

  function replicarNoPar(id: string) {
    const par = layout.pairOf(id);
    if (!par) return;
    const f = forma(id);
    setFormas((a) => ({ ...a, [par]: mirrorShape(f) }));
    setPerguntarPar(null);
    setSalvo(false);
  }

  /** Média dos dois lados: o par pousa simétrico e em valores inteiros. */
  function alinhar(id: string) {
    const f = forma(id);
    const par = layout.pairOf(id);
    const prop: Shape = {
      dx: Math.round(f.dx),
      dy: Math.round(f.dy),
      rot: Math.round(f.rot * 2) / 2,
      sx: f.sx,
      sy: f.sy,
    };
    if (par) {
      const g = forma(par);
      const sinalX = f.dx < 0 ? -1 : 1;
      prop.dx = Math.round((Math.abs(f.dx) + Math.abs(g.dx)) / 2) * sinalX;
      prop.dy = Math.round((f.dy + g.dy) / 2);
      prop.sx =
        (Math.round(((Math.abs(f.sx) + Math.abs(g.sx)) / 2) * 100) / 100) * (f.sx < 0 ? -1 : 1);
      prop.sy = Math.round(((Math.abs(f.sy) + Math.abs(g.sy)) / 2) * 100) / 100;
      prop.rot =
        (Math.round(((Math.abs(f.rot) + Math.abs(g.rot)) / 2) * 2) / 2) * (f.rot < 0 ? -1 : 1);
    }
    aplicarForma(id, prop);
    if (par) window.setTimeout(() => replicarNoPar(id), 0);
  }

  function pontoSvg(event: { clientX: number; clientY: number }): Pt | null {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const p = svg.createSVGPoint();
    p.x = event.clientX;
    p.y = event.clientY;
    const local = p.matrixTransform(matrix.inverse());
    return { x: local.x, y: local.y };
  }

  // ── leitura do desenho: o que está livre, o que está sob o toque ──
  function dentroDe(selector: string, x: number, y: number) {
    const svg = svgRef.current;
    const node = svg?.querySelector<SVGGeometryElement>(selector);
    if (!svg || !node || typeof node.isPointInFill !== "function") return false;
    const p = svg.createSVGPoint();
    p.x = x;
    p.y = y;
    try {
      return node.isPointInFill(p);
    } catch {
      return false;
    }
  }

  function livreEm(x: number, y: number) {
    const svg = svgRef.current;
    if (!svg || !dentroDe("path.eb-limite", x, y)) return false;
    const p = svg.createSVGPoint();
    p.x = x;
    p.y = y;
    for (const node of Array.from(svg.querySelectorAll<SVGGeometryElement>("path.eb-zona"))) {
      try {
        if (node.isPointInFill(p)) return false;
      } catch {
        /* ignora */
      }
    }
    return true;
  }

  function zonaEm(x: number, y: number): FaceZone | null {
    let achada: FaceZone | null = null;
    for (const z of lista) if (dentroDe(`path.eb-zona[data-zona="${z.id}"]`, x, y)) achada = z;
    return achada;
  }

  function regiaoSob(id: string): FaceZone | null {
    const alvo = layout.zoneById(id);
    if (!alvo) return null;
    const c = centroid(pointsOf(transformedPath(alvo.d, forma(id))));
    if (!Number.isFinite(c.x)) return null;
    let achada: FaceZone | null = null;
    for (const z of lista) {
      if (z.id === id) continue;
      if (dentroDe(`path.eb-zona[data-zona="${z.id}"]`, c.x, c.y)) achada = z;
    }
    return achada;
  }

  // ── gestos de arrastar ──
  const aoMover = useCallback((event: PointerEvent) => {
    const g = gesto.current;
    if (!g) return;
    const q = pontoSvg(event);
    if (!q) return;
    const dx = q.x - g.p0.x;
    const dy = q.y - g.p0.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) g.moved = true;
    // Alças nunca invertem: o sinal do espelho fica, a magnitude entre 0,35 e 2,4.
    const lim = (v: number, base: number) =>
      (base < 0 ? -1 : 1) * Math.max(0.35, Math.min(2.4, Math.abs(v)));
    if (g.mode === "mover") {
      aplicarForma(g.id, { dx: g.f0.dx + dx, dy: g.f0.dy + dy });
      return;
    }
    if (g.mode === "girar") {
      const cx = g.bb.x + g.bb.w / 2 + g.f0.dx;
      const cy = g.bb.y + g.bb.h / 2 + g.f0.dy;
      const ang = (Math.atan2(q.y - cy, q.x - cx) * 180) / Math.PI;
      aplicarForma(g.id, { rot: Math.round((g.f0.rot + (ang - g.ang0)) * 10) / 10 });
      return;
    }
    const parcial: Partial<Shape> = {};
    const ax = Math.abs(g.f0.sx);
    const ay = Math.abs(g.f0.sy);
    if (g.mode.includes("l")) parcial.sx = lim(ax - (2 * dx) / g.bb.w, g.f0.sx);
    if (g.mode.includes("r")) parcial.sx = lim(ax + (2 * dx) / g.bb.w, g.f0.sx);
    if (g.mode.includes("t")) parcial.sy = lim(ay - (2 * dy) / g.bb.h, g.f0.sy);
    if (g.mode.includes("b")) parcial.sy = lim(ay + (2 * dy) / g.bb.h, g.f0.sy);
    aplicarForma(g.id, parcial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const soltar = useCallback(() => {
    const g = gesto.current;
    window.removeEventListener("pointermove", aoMover);
    window.removeEventListener("pointerup", soltar);
    window.removeEventListener("pointercancel", soltar);
    if (!g) return;
    gesto.current = null;
    if (g.mode === "mover" && g.moved) {
      const sob = regiaoSob(g.id);
      const atual = live.current.layout.nameOf(g.id);
      const sug = sob ? live.current.layout.nameOf(sob.id) : null;
      setSugestao(sug && sug !== atual ? { id: g.id, nome: sug } : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aoMover]);

  function iniciarGesto(id: string, mode: string, event: ReactPointerEvent) {
    const zone = live.current.layout.zoneById(id);
    const p0 = pontoSvg(event);
    const bb = bbox(zone?.d);
    if (!p0 || !bb) return;
    event.preventDefault();
    event.stopPropagation();
    const f0 = forma(id);
    const cx = bb.x + bb.w / 2 + f0.dx;
    const cy = bb.y + bb.h / 2 + f0.dy;
    gesto.current = {
      id,
      mode,
      p0,
      f0,
      bb,
      ang0: (Math.atan2(p0.y - cy, p0.x - cx) * 180) / Math.PI,
      moved: false,
    };
    window.addEventListener("pointermove", aoMover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
  }

  useEffect(() => () => soltar(), [soltar]);

  // ── criar região: varredura de raios com refino binário lê o vão sob o toque ──
  function varrer(
    cx: number,
    cy: number,
    podeIr: (x: number, y: number) => boolean,
    cfg: { raios: number; passo: number; max: number; min?: number; folga?: number },
  ) {
    const pts: { ang: number; r: number }[] = [];
    for (let i = 0; i < cfg.raios; i++) {
      const ang = (i / cfg.raios) * Math.PI * 2;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      let livre = 0;
      let bloq = cfg.passo;
      while (bloq < cfg.max && podeIr(cx + dx * bloq, cy + dy * bloq)) {
        livre = bloq;
        bloq += cfg.passo;
      }
      for (let k = 0; k < 4; k++) {
        const meio = (livre + bloq) / 2;
        if (podeIr(cx + dx * meio, cy + dy * meio)) livre = meio;
        else bloq = meio;
      }
      pts.push({ ang, r: Math.max(cfg.min ?? 2, livre - (cfg.folga ?? 0)) });
    }
    return pts;
  }

  function poligonoDe(
    cx: number,
    cy: number,
    pts: { ang: number; r: number }[],
    fator: number,
    teto: number,
  ): Pt[] {
    let poli = pts.map((p) => {
      const r = fator ? Math.max(8, Math.min(p.r * fator, teto)) : Math.min(p.r, teto);
      return { x: cx + Math.cos(p.ang) * r, y: cy + Math.sin(p.ang) * r };
    });
    poli = smooth(smooth(poli));
    return poli.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
  }

  function contornoDoVazio(cx: number, cy: number): Pt[] | null {
    const pts = varrer(cx, cy, livreEm, { raios: 48, passo: 4, max: 300, folga: 3 });
    const rs = pts.map((p) => p.r).sort((a, b) => a - b);
    const mediana = rs[Math.floor(rs.length / 2)] ?? 0;
    const poli = poligonoDe(cx, cy, pts, 0, Math.max(mediana * 2.1, mediana + 26));
    return areaOf(poli) > 420 ? poli : null;
  }

  function contornoInterno(mae: FaceZone, cx: number, cy: number): Pt[] | null {
    const filhas = novas.filter((n) => n.mae === mae.id);
    const podeIr = (x: number, y: number) => {
      if (!dentroDe(`path.eb-zona[data-zona="${mae.id}"]`, x, y)) return false;
      return !filhas.some((filha) => dentroDe(`path.eb-zona[data-zona="${filha.id}"]`, x, y));
    };
    const pts = varrer(cx, cy, podeIr, { raios: 40, passo: 3, max: 200, min: 8 });
    const poli = poligonoDe(cx, cy, pts, 0.52, 74);
    return areaOf(poli) > 260 ? poli : null;
  }

  function maeDe(d: string): string | null {
    const c = centroid(pointsOf(d));
    let achada: string | null = null;
    for (const z of lista)
      if (dentroDe(`path.eb-zona[data-zona="${z.id}"]`, c.x, c.y)) achada = z.id;
    return achada;
  }

  function pousarRascunho(event: ReactPointerEvent) {
    const p = pontoSvg(event);
    if (!p) return;
    event.preventDefault();
    event.stopPropagation();
    const pt = { x: Math.round(p.x), y: Math.round(p.y) };
    if (modoDesenho !== "auto") {
      setRascunho((r) => [...r, pt]);
      setAviso(null);
      return;
    }
    const livre = livreEm(pt.x, pt.y);
    const sob = livre ? null : zonaEm(pt.x, pt.y);
    let contorno: Pt[] | null = null;
    let msg: string | null = null;
    let nome: string | null = null;
    if (livre) {
      contorno = contornoDoVazio(pt.x, pt.y);
      if (contorno) {
        const c = centroid(contorno);
        nome = likelyName(c.x, c.y);
      } else {
        contorno = freeShape(pt.x, pt.y, 54);
        msg = "Vão estreito demais para ler. Deixei um formato livre: ajuste pelas alças.";
        nome = likelyName(pt.x, pt.y);
      }
    } else if (sob) {
      contorno = contornoInterno(sob, pt.x, pt.y);
      nome = `${nomeDe(sob)} · microrregião`;
      msg = contorno
        ? `Microrregião dentro de ${nomeDe(sob)}.`
        : `Pouco espaço dentro de ${nomeDe(sob)}. Deixei uma microrregião mínima.`;
      if (!contorno) contorno = freeShape(pt.x, pt.y, 26);
    } else {
      contorno = freeShape(pt.x, pt.y, 54);
      msg = "Fora do rosto. Deixei um formato livre: ajuste pelas alças.";
      nome = likelyName(pt.x, pt.y);
    }
    setRascunho(contorno);
    setAviso(msg);
    setNomeNova((n) => n || nome || "");
  }

  /** Rascunho com largura, altura, giro e folga aplicados. */
  const rascunhoAjustado = useMemo(() => {
    if (rascunho.length < 3) return rascunho;
    const c = centroid(rascunho);
    const rad = (formaR.rot * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return rascunho.map((p) => {
      const vx = (p.x - c.x) * formaR.sx;
      const vy = (p.y - c.y) * formaR.sy;
      let x = vx * cos - vy * sin;
      let y = vx * sin + vy * cos;
      const d = Math.sqrt(x * x + y * y) || 1;
      x += (x / d) * formaR.folga;
      y += (y / d) * formaR.folga;
      return { x: Math.round(c.x + x), y: Math.round(c.y + y) };
    });
  }, [rascunho, formaR]);

  function criarRegiao(d: string, nome: string) {
    const id = `propria-${Date.now()}`;
    const c = centroid(pointsOf(d));
    setNovas((n) => [...n, { id, nome, d, c: [Math.round(c.x), Math.round(c.y)], mae: maeDe(d) }]);
    setDesenhando(false);
    setRascunho([]);
    setFormaR(DRAFT0);
    setNomeNova("");
    setAviso(null);
    setEdicao(id);
    setSalvo(false);
  }

  function copiarZona(z: FaceZone, espelhar: boolean) {
    const id = `propria-${Date.now()}`;
    const base = nomeDe(z);
    const f = forma(z.id);
    const nome = espelhar
      ? base.replace(/direita/i, "esquerda").replace(/direito/i, "esquerdo") +
        (/(direita|esquerda|direito|esquerdo)/i.test(base) ? "" : " espelhada")
      : `${base} (cópia)`;
    const nf: Shape = espelhar
      ? { ...f, sx: -Math.abs(f.sx), dx: -f.dx, rot: -f.rot }
      : { ...f, dx: f.dx + 30, dy: f.dy + 30 };
    setNovas((n) => [...n, { id, nome, d: z.d, c: z.c }]);
    setFormas((a) => ({ ...a, [id]: nf }));
    setEdicao(id);
    setSalvo(false);
  }

  function excluirZona(id: string) {
    const nativa = layout.zoneById(id) && !novas.some((n) => n.id === id);
    setNovas((n) => n.filter((x) => x.id !== id && x.mae !== id));
    if (nativa) setOcultas((o) => [...o, id]);
    setFormas((a) => {
      const n = { ...a };
      delete n[id];
      return n;
    });
    setNomes((a) => {
      const n = { ...a };
      delete n[id];
      return n;
    });
    setEdicao(null);
    setPerguntarPar(null);
    setSugestao(null);
    setSalvo(false);
  }

  function salvarFormas() {
    if (writePack(pack)) setSalvo(true);
  }

  function salvarComoPadrao() {
    const next = [
      ...padroes,
      { id: `p-${Date.now()}`, nome: `Padrão ${padroes.length + 1}`, ...pack },
    ];
    writePresets(next);
    setPadroes(next);
    setPadraoAtivo(next[next.length - 1]?.id ?? null);
    setSalvo(true);
  }

  function carregarPadrao(p: LayoutPreset) {
    setFormas(p.formas ?? {});
    setNovas(p.novas ?? []);
    setNomes(p.nomes ?? {});
    setOcultas(p.ocultas ?? []);
    setPadraoAtivo(p.id);
    setEdicao(null);
    setPerguntarPar(null);
    setSugestao(null);
    writePack({
      formas: p.formas ?? {},
      novas: p.novas ?? [],
      nomes: p.nomes ?? {},
      ocultas: p.ocultas ?? [],
    });
    setSalvo(true);
  }

  function redefinirTudo() {
    const vazio = emptyPack();
    setFormas(vazio.formas);
    setNovas(vazio.novas);
    setNomes(vazio.nomes);
    setOcultas(vazio.ocultas);
    setSincronia({});
    setPerguntarPar(null);
    setSugestao(null);
    setEdicao(null);
    setPadraoAtivo(null);
    writePack(vazio);
    setSalvo(false);
  }

  // ── alças da região em edição ──
  const alcas = useMemo(() => {
    if (!zonaEd) return null;
    const bb = bbox(zonaEd.d);
    if (!bb) return null;
    const f = { ...NEUTRAL, ...(formas[zonaEd.id] ?? {}) };
    const cx = bb.x + bb.w / 2;
    const cy = bb.y + bb.h / 2;
    const x = cx - (bb.w * f.sx) / 2;
    const y = cy - (bb.h * f.sy) / 2;
    const w = bb.w * f.sx;
    const h = bb.h * f.sy;
    const pontos: [string, number, number][] = [
      ["tl", x, y],
      ["t", x + w / 2, y],
      ["tr", x + w, y],
      ["l", x, y + h / 2],
      ["r", x + w, y + h / 2],
      ["bl", x, y + h],
      ["b", x + w / 2, y + h],
      ["br", x + w, y + h],
    ];
    return {
      transform: `translate(${cx + f.dx} ${cy + f.dy}) rotate(${f.rot}) translate(${-cx} ${-cy})`,
      x,
      y,
      w,
      h,
      giroX: x + w / 2,
      giroY: y - 62,
      pontos,
    };
  }, [zonaEd, formas]);

  const f = zonaEd ? forma(zonaEd.id) : NEUTRAL;
  const ajustadas = Object.keys(formas).filter((k) => {
    const v = { ...NEUTRAL, ...(formas[k] ?? {}) };
    return v.dx || v.dy || v.rot || v.sx !== 1 || v.sy !== 1;
  });

  const overlay = (
    <>
      {desenhando ? (
        <g>
          <rect
            x={0}
            y={0}
            width={FACE_VIEWBOX.width}
            height={FACE_VIEWBOX.height}
            fill="rgba(79,175,173,.05)"
            style={{ cursor: "crosshair" }}
            onPointerDown={pousarRascunho}
          />
          <path
            d={pathOfPoints(rascunhoAjustado)}
            fill="rgba(79,175,173,.22)"
            stroke="var(--eb-teal-500)"
            strokeWidth={2.4}
            strokeDasharray="9 7"
            strokeLinejoin="round"
            style={{ pointerEvents: "none" }}
          />
          {rascunhoAjustado.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={9}
              fill="var(--eb-teal-500)"
              stroke="var(--eb-plum-900)"
              strokeWidth={2.5}
              style={{ pointerEvents: "none" }}
            />
          ))}
        </g>
      ) : null}
      {alcas && zonaEd && !desenhando ? (
        <g transform={alcas.transform} style={{ pointerEvents: "auto" }}>
          <rect
            x={alcas.x}
            y={alcas.y}
            width={alcas.w}
            height={alcas.h}
            fill="none"
            stroke="var(--eb-teal-500)"
            strokeWidth={2}
            strokeDasharray="10 8"
            style={{ pointerEvents: "none" }}
          />
          {alcas.pontos.map(([mode, x, y]) => (
            <circle
              key={mode}
              cx={x}
              cy={y}
              r={15}
              fill="var(--eb-teal-500)"
              stroke="var(--eb-plum-900)"
              strokeWidth={3}
              style={{ cursor: "grab", touchAction: "none" }}
              onPointerDown={(event) => iniciarGesto(zonaEd.id, mode, event)}
            />
          ))}
          <line
            x1={alcas.giroX}
            y1={alcas.y}
            x2={alcas.giroX}
            y2={alcas.giroY}
            stroke="var(--eb-teal-500)"
            strokeWidth={2}
            style={{ pointerEvents: "none" }}
          />
          <circle
            cx={alcas.giroX}
            cy={alcas.giroY}
            r={17}
            fill="var(--eb-nude-500)"
            stroke="var(--eb-plum-900)"
            strokeWidth={3}
            style={{ cursor: "grab", touchAction: "none" }}
            onPointerDown={(event) => iniciarGesto(zonaEd.id, "girar", event)}
          />
        </g>
      ) : null}
    </>
  );

  const parId = zonaEd ? layout.pairOf(zonaEd.id) : null;

  return (
    <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[420px]">
        <FaceMap
          layout={layout}
          svgRef={svgRef}
          editing
          overlay={overlay}
          selected={edicao}
          allowPoints={false}
          points={[]}
          marks={[]}
          onAddPoint={() => {}}
          onSelectZone={(z) => {
            if (!desenhando) setEdicao(z.id);
          }}
          onZonePointerDown={(z, event) => {
            if (desenhando) return;
            if (edicao !== z.id) setEdicao(z.id);
            iniciarGesto(z.id, "mover", event);
          }}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className={cn(label, "flex-1")}>Editar regiões</span>
          <span className="font-mono text-xs text-muted-foreground">
            {ajustadas.length === 0
              ? "nenhuma alterada"
              : ajustadas.length === 1
                ? "1 alterada"
                : `${ajustadas.length} alteradas`}
          </span>
          {onExit ? (
            <Button type="button" variant="secondary" size="sm" onClick={onExit}>
              Concluir
            </Button>
          ) : null}
        </div>

        {desenhando ? (
          <Panel>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[17px] font-medium">Nova região</div>
                <div className="text-xs leading-[1.4] text-muted-foreground">
                  {aviso ??
                    (modoDesenho === "auto"
                      ? rascunho.length
                        ? "Área lida. Ajuste o nome e crie: depois dá para moldar."
                        : "Toque num espaço livre do rosto e o formato é desenhado."
                      : rascunho.length
                        ? `${rascunho.length} pontos · mínimo 3`
                        : "Toque no rosto marcando os vértices, no mínimo 3.")}
                </div>
              </div>
              <IconButton
                icon="X"
                label="Cancelar nova região"
                size={44}
                onClick={() => {
                  setDesenhando(false);
                  setRascunho([]);
                  setNomeNova("");
                  setAviso(null);
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] p-1">
              <Pill
                on={modoDesenho === "auto"}
                onClick={() => {
                  setModoDesenho("auto");
                  setRascunho([]);
                  setAviso(null);
                }}
              >
                Tocar no vazio
              </Pill>
              <Pill
                on={modoDesenho === "pontos"}
                onClick={() => {
                  setModoDesenho("pontos");
                  setRascunho([]);
                  setAviso(null);
                }}
              >
                Ponto a ponto
              </Pill>
            </div>

            <div>
              <span className="mb-[7px] block text-[11.5px] text-[var(--text-secondary)]">
                Moldes para os espaços livres
              </span>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {FACE_MOLDS.map((mold) => (
                  <button
                    key={mold.nome}
                    type="button"
                    onClick={() => criarRegiao(mold.d, nomeNova.trim() || mold.nome)}
                    className="min-h-11 flex-none whitespace-nowrap rounded-full border border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] px-3 text-[12.5px] text-[var(--text-secondary)]"
                  >
                    {mold.nome}
                  </button>
                ))}
              </div>
            </div>

            {rascunho.length >= 3 ? (
              <div className="grid grid-cols-2 gap-3">
                <Slider
                  label="Larg."
                  shown={`${Math.round(formaR.sx * 100)}%`}
                  min={0.4}
                  max={2.2}
                  step={0.01}
                  value={formaR.sx}
                  onChange={(v) => setFormaR({ ...formaR, sx: v })}
                />
                <Slider
                  label="Alt."
                  shown={`${Math.round(formaR.sy * 100)}%`}
                  min={0.4}
                  max={2.2}
                  step={0.01}
                  value={formaR.sy}
                  onChange={(v) => setFormaR({ ...formaR, sy: v })}
                />
                <Slider
                  label="Giro"
                  shown={`${formaR.rot}°`}
                  min={-45}
                  max={45}
                  step={0.5}
                  value={formaR.rot}
                  onChange={(v) => setFormaR({ ...formaR, rot: v })}
                />
                <Slider
                  label="Folga"
                  shown={`${formaR.folga > 0 ? "+" : ""}${formaR.folga}`}
                  min={-16}
                  max={16}
                  step={1}
                  value={formaR.folga}
                  onChange={(v) => setFormaR({ ...formaR, folga: v })}
                />
              </div>
            ) : null}

            <label className="block">
              <span className="mb-1.5 block text-[11.5px] text-[var(--text-secondary)]">
                Nome da região
              </span>
              <input
                value={nomeNova}
                placeholder="ex.: Lábio superior"
                onChange={(event) => setNomeNova(event.target.value)}
                className={textField}
              />
            </label>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!rascunho.length}
                onClick={() => {
                  setRascunho(modoDesenho === "auto" ? [] : rascunho.slice(0, -1));
                  setAviso(null);
                }}
              >
                <Icon name="Undo2" size={15} /> Desfazer
              </Button>
              <Button
                type="button"
                size="sm"
                className="flex-1"
                disabled={rascunhoAjustado.length < 3}
                onClick={() =>
                  criarRegiao(pathOfPoints(rascunhoAjustado), nomeNova.trim() || "Região sem nome")
                }
              >
                Criar região
              </Button>
            </div>
          </Panel>
        ) : null}

        {zonaEd && !desenhando ? (
          <Panel>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <input
                  value={nomeDe(zonaEd)}
                  aria-label="Nome da região"
                  onChange={(event) => {
                    setNomes({ ...nomes, [zonaEd.id]: event.target.value });
                    setSalvo(false);
                  }}
                  className="w-full border-0 border-b border-[var(--border-hairline)] bg-transparent p-0 text-[17px] font-medium leading-normal text-foreground outline-none"
                />
                <div className="font-mono text-xs text-muted-foreground">
                  x {Math.round(f.dx)} · y {Math.round(f.dy)} · {Math.round(Math.abs(f.sx) * 100)}%
                  × {Math.round(Math.abs(f.sy) * 100)}% · {f.rot}°
                </div>
              </div>
              <IconButton
                icon="X"
                label="Fechar edição da região"
                size={44}
                onClick={() => setEdicao(null)}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Slider
                label="Larg."
                shown={`${Math.round(Math.abs(f.sx) * 100)}%`}
                min={0.4}
                max={2.2}
                step={0.01}
                value={Math.abs(f.sx)}
                onChange={(v) => aplicarForma(zonaEd.id, { sx: (f.sx < 0 ? -1 : 1) * v })}
              />
              <Slider
                label="Alt."
                shown={`${Math.round(Math.abs(f.sy) * 100)}%`}
                min={0.4}
                max={2.2}
                step={0.01}
                value={Math.abs(f.sy)}
                onChange={(v) => aplicarForma(zonaEd.id, { sy: (f.sy < 0 ? -1 : 1) * v })}
              />
              <Slider
                label="Giro"
                shown={`${f.rot}°`}
                min={-45}
                max={45}
                step={0.5}
                value={f.rot}
                onChange={(v) => aplicarForma(zonaEd.id, { rot: v })}
              />
            </div>

            {sugestao && sugestao.id === zonaEd.id ? (
              <div className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--border-hairline)] bg-[var(--eb-nude-a08)] px-3 py-2.5">
                <span className="min-w-0 flex-1 text-xs text-[var(--text-secondary)]">
                  Agora sobre <span className="text-foreground">{sugestao.nome}</span>
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setNomes({ ...nomes, [sugestao.id]: sugestao.nome });
                    setSugestao(null);
                    setSalvo(false);
                  }}
                >
                  Renomear
                </Button>
              </div>
            ) : null}

            {perguntarPar === zonaEd.id && parId ? (
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a12)] px-3 py-2.5">
                <span className="min-w-0 flex-1 text-[12.5px] text-[var(--text-secondary)]">
                  Replicar em <span className="text-foreground">{layout.nameOf(parId)}</span>?
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPerguntarPar(null)}
                >
                  Agora não
                </Button>
                <Button type="button" size="sm" onClick={() => replicarNoPar(zonaEd.id)}>
                  Replicar
                </Button>
              </div>
            ) : null}

            {parId ? (
              <label className="flex cursor-pointer items-center gap-[9px]">
                <input
                  type="checkbox"
                  checked={Boolean(sincronia[zonaEd.id])}
                  onChange={(event) => {
                    const liga = event.target.checked;
                    setSincronia({ ...sincronia, [zonaEd.id]: liga });
                    if (liga) replicarNoPar(zonaEd.id);
                  }}
                  className="size-[18px] flex-none accent-[var(--teal)]"
                />
                <span className="text-[12.5px] text-[var(--text-secondary)]">
                  Espelhar sempre no lado oposto
                </span>
              </label>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => alinhar(zonaEd.id)}>
                <Icon name="AlignCenterHorizontal" size={15} /> Alinhar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => copiarZona(zonaEd, true)}
              >
                <Icon name="FlipHorizontal" size={15} /> Espelhar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => copiarZona(zonaEd, false)}
              >
                <Icon name="Copy" size={15} /> Duplicar
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => excluirZona(zonaEd.id)}
              >
                <Icon name="Trash2" size={15} /> Excluir
              </Button>
            </div>

            <div className="flex gap-2 border-t border-[var(--border-hairline)] pt-2.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFormas((a) => {
                    const n = { ...a };
                    delete n[zonaEd.id];
                    return n;
                  });
                  setSalvo(false);
                }}
              >
                Redefinir
              </Button>
              <Button type="button" size="sm" className="flex-1" onClick={salvarFormas}>
                {salvo ? "Salvo" : "Salvar forma"}
              </Button>
            </div>
          </Panel>
        ) : null}

        {!zonaEd && !desenhando ? (
          <>
            <div className="flex items-start gap-2.5 rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] px-4 py-3.5">
              <Icon name="Move" size={18} color="var(--eb-nude-300)" className="mt-0.5 flex-none" />
              <div className="min-w-0">
                <div className="text-[13.5px] text-foreground">Toque em uma região para editar</div>
                <div className="text-xs leading-[1.45] text-muted-foreground">
                  Arraste para mover, alças para esticar, alça nude para girar. Pares perguntam se
                  replicam no lado oposto; Alinhar deixa os dois simétricos.
                </div>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={() => {
                setDesenhando(true);
                setRascunho([]);
                setNomeNova("");
                setFormaR(DRAFT0);
                setAviso(null);
                setEdicao(null);
              }}
            >
              <Icon name="PlusCircle" size={15} /> Nova região
            </Button>
            <Button
              type="button"
              variant="tech"
              size="sm"
              className="w-full"
              onClick={() => {
                salvarFormas();
                salvarComoPadrao();
              }}
            >
              <Icon name="Save" size={15} /> {salvo ? "Padrão salvo" : "Salvar como novo padrão"}
            </Button>

            <div className="mt-1 flex items-center gap-2.5">
              <span className={cn(label, "flex-1")}>Padrões salvos</span>
              <span className="font-mono text-xs text-muted-foreground">
                {padroes.length
                  ? padroes.length === 1
                    ? "1 padrão"
                    : `${padroes.length} padrões`
                  : ""}
              </span>
            </div>
            {padroes.length ? (
              <div className="flex flex-col gap-1.5">
                {padroes.map((p) => (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center gap-2 rounded-[var(--radius-md)] border bg-[var(--surface-card)] py-2 pl-3 pr-2.5",
                      padraoAtivo === p.id
                        ? "border-[var(--eb-teal-a40)]"
                        : "border-[var(--border-card)]",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => carregarPadrao(p)}
                      className="min-h-11 min-w-0 flex-1 text-left"
                    >
                      <span className="block text-[13.5px] text-foreground">{p.nome}</span>
                      <span className="block font-mono text-[11.5px] text-muted-foreground">
                        {Object.keys(p.formas ?? {}).length} ajustes · {(p.novas ?? []).length}{" "}
                        criadas
                      </span>
                    </button>
                    <IconButton
                      icon="Trash2"
                      label="Excluir padrão"
                      size={44}
                      onClick={() => {
                        const next = padroes.filter((x) => x.id !== p.id);
                        writePresets(next);
                        setPadroes(next);
                        if (padraoAtivo === p.id) setPadraoAtivo(null);
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-xs leading-[1.45] text-muted-foreground">
                Nenhum padrão ainda. Ajuste as regiões e salve: cada padrão guarda todos os encaixes
                e formas.
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={redefinirTudo}
            >
              Redefinir todas as regiões
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
