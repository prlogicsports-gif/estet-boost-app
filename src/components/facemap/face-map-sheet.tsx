import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  ChevronRight,
  Hand,
  type LucideIcon,
  MessageCircle,
  Milk,
  Sparkles,
  X,
} from "lucide-react";

import type { FaceZone } from "@/components/facemap/face-data";
import { useFaceLayout } from "@/lib/face-layout";
import { FaceZonePhotos, type ZonePhotos } from "@/components/eb/face-zone-photos";
import { Button } from "@/components/ui/button";
import { stockDb } from "@/data/db";
import { emptyRecord, type FaceMark, type FaceRecord } from "@/lib/face-map-store";
import { cn } from "@/lib/utils";

const PROCEDIMENTOS = [
  "Limpeza de pele profunda",
  "Peeling suave",
  "Hidratação facial",
  "Drenagem facial",
  "Extração",
  "Microagulhamento",
  "Massagem modeladora facial",
];
const ACOES = [
  "Aplicação de ativo",
  "Assepsia",
  "Esfoliação",
  "Máscara calmante",
  "Fotografia de acompanhamento",
  "Orientação de cuidado em casa",
];

type RowKey = "procedimento" | "produto" | "acao" | "observacao";

function Row({
  icon: Icon,
  label,
  value,
  open,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="flex min-h-11 w-full items-center gap-3.5 border-b border-[var(--border-hairline)] px-4 py-3.5 text-left last:border-b-0"
    >
      <Icon className="size-[19px] flex-none text-[var(--nude-sand)]" aria-hidden />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[15px]",
            value ? "text-foreground" : "text-[var(--text-secondary)]",
          )}
        >
          {label}
        </span>
        {value ? (
          <span className="mt-0.5 block truncate text-[12.5px] text-[var(--teal)]">{value}</span>
        ) : null}
      </span>
      <ChevronRight
        className={cn(
          "size-[18px] flex-none text-muted-foreground transition-transform",
          open && "rotate-90",
        )}
        aria-hidden
      />
    </button>
  );
}

function Options({
  items,
  value,
  onPick,
}: {
  items: string[];
  value: string;
  onPick: (item: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-4 pt-1">
      {items.map((item) => {
        const on = item === value;
        return (
          <button
            key={item}
            type="button"
            onClick={() => onPick(on ? "" : item)}
            aria-pressed={on}
            className={cn(
              "min-h-[38px] rounded-full border px-3.5 text-left text-[13px] transition-colors",
              on
                ? "border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a24)] text-foreground"
                : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] text-[var(--text-secondary)]",
            )}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-[18px]">
      <span className="text-[11px] font-medium uppercase leading-none tracking-[0.14em] text-muted-foreground">
        {title}
      </span>
      {children}
    </div>
  );
}

/**
 * Painel de registro da região selecionada, como na referência: nome da região,
 * as linhas com ícone e chevron, e a ação "Salvar marcação". Nada é gravado
 * sem a esteticista confirmar.
 */
export function FaceMapSheet({
  zone,
  pointCount,
  history,
  photos,
  onPhotosChange,
  inline = false,
  onClose,
  onSave,
  onClear,
}: {
  zone: FaceZone | null;
  pointCount: number;
  history: FaceMark[];
  /** Em tela larga o painel fica ao lado do mapa, sem cobrir o rosto. */
  inline?: boolean;
  photos?: ZonePhotos | undefined;
  onPhotosChange?: ((next: ZonePhotos) => void) | undefined;
  onClose: () => void;
  onSave: (record: FaceRecord, pairId: string | null) => void;
  onClear: () => void;
}) {
  const layout = useFaceLayout();
  const [row, setRow] = useState<RowKey | null>(null);
  const [form, setForm] = useState<FaceRecord>(emptyRecord);
  const [mirror, setMirror] = useState(false);
  const zoneId = zone?.id;

  useEffect(() => {
    setRow(null);
    setForm(emptyRecord);
    setMirror(false);
  }, [zoneId]);

  useEffect(() => {
    if (!zoneId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoneId, onClose]);

  if (!zone) return null;

  const set = (key: RowKey, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const toggle = (key: RowKey) => setRow((current) => (current === key ? null : key));
  const ready = Boolean(form.procedimento || form.produto || form.acao || form.observacao);
  const pairId = layout.pairOf(zone.id);
  const pair = pairId ? layout.zoneById(pairId) : null;
  const alreadySaved = history.length > 0;

  return (
    <div
      role="dialog"
      aria-label={`Registro em ${zone.nome}`}
      className={cn(
        "flex flex-col border border-[var(--glass-border)] bg-[var(--glass-bg-strong)] backdrop-blur-[22px] backdrop-saturate-[1.15]",
        inline
          ? "max-h-[calc(100vh-3rem)] rounded-[var(--radius-2xl)]"
          : "absolute inset-x-0 bottom-0 z-10 max-h-[78%] rounded-t-[var(--radius-2xl)] border-b-0",
      )}
      style={{
        boxShadow: inline
          ? "var(--glass-shadow), var(--glass-highlight)"
          : "var(--shadow-sheet), var(--glass-highlight)",
        animation: "sheet-in 280ms cubic-bezier(.16,1,.3,1)",
      }}
    >
      {inline ? null : (
        <div className="grid place-items-center pt-3">
          <span className="h-[5px] w-[46px] rounded-full bg-[var(--eb-nude-a32)]" />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-3.5">
        <div className="flex items-start gap-3">
          <h2 className="flex-1 text-[26px] font-medium leading-[1.2] tracking-[-0.015em] text-foreground">
            {zone.nome}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-11 flex-none place-items-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="size-[18px]" aria-hidden />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="inline-flex rounded-full bg-[var(--eb-ivory-a06)] px-2.5 py-1 font-mono text-[11.5px] text-[var(--text-secondary)]">
            {pointCount === 1 ? "1 ponto de ação" : `${pointCount} pontos de ação`}
          </span>
          {alreadySaved ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--eb-teal-a12)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--teal)]">
              <Check className="size-3" strokeWidth={2.4} aria-hidden /> Marcação salva
            </span>
          ) : null}
        </div>
        {pointCount === 0 ? (
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            Toque de novo dentro da região para pousar um ponto de ação.
          </p>
        ) : null}

        <div className="mt-[18px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)]">
          <Row
            icon={Sparkles}
            label="Procedimento"
            value={form.procedimento}
            open={row === "procedimento"}
            onClick={() => toggle("procedimento")}
          />
          {row === "procedimento" ? (
            <Options
              items={PROCEDIMENTOS}
              value={form.procedimento}
              onPick={(v) => set("procedimento", v)}
            />
          ) : null}
          <Row
            icon={Milk}
            label="Produto"
            value={form.produto}
            open={row === "produto"}
            onClick={() => toggle("produto")}
          />
          {row === "produto" ? (
            <Options
              items={stockDb.use().map((p) => p.name)}
              value={form.produto}
              onPick={(v) => set("produto", v)}
            />
          ) : null}
          <Row
            icon={Hand}
            label="Ação"
            value={form.acao}
            open={row === "acao"}
            onClick={() => toggle("acao")}
          />
          {row === "acao" ? (
            <Options items={ACOES} value={form.acao} onPick={(v) => set("acao", v)} />
          ) : null}
          <Row
            icon={MessageCircle}
            label="Observação"
            value={form.observacao}
            open={row === "observacao"}
            onClick={() => toggle("observacao")}
          />
          {row === "observacao" ? (
            <div className="px-4 pb-4 pt-1">
              <textarea
                rows={3}
                value={form.observacao}
                aria-label="Observação"
                placeholder="O que você observou nesta região?"
                onChange={(event) => set("observacao", event.target.value)}
                className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-field)] px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          ) : null}
        </div>

        {pair ? (
          <label className="mt-3.5 flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={mirror}
              onChange={(event) => setMirror(event.target.checked)}
              className="mt-0.5 size-[18px] flex-none accent-[var(--teal)]"
            />
            <span className="text-[13px] leading-[1.45] text-[var(--text-secondary)]">
              Registrar também no lado oposto: {layout.nameOf(pair.id)}
            </span>
          </label>
        ) : null}

        {onPhotosChange ? (
          <Section title="Fotografias desta região">
            <div className="mt-2">
              <FaceZonePhotos
                photos={photos ?? {}}
                onChange={onPhotosChange}
                zoneLabel={zone.nome}
              />
            </div>
          </Section>
        ) : null}

        {history.length ? (
          <Section title={`Histórico desta região · ${history.length}`}>
            <div className="mt-2 flex flex-col gap-1.5">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2.5 rounded-[var(--radius-sm)] bg-[var(--eb-ivory-a06)] px-3 py-2.5 text-[12.5px]"
                >
                  <span className="flex-none font-mono text-muted-foreground">{item.date}</span>
                  <span className="min-w-0 flex-1 text-[var(--text-secondary)]">
                    {[item.procedimento, item.produto, item.acao].filter(Boolean).join(" · ") ||
                      item.observacao ||
                      "Registro"}
                  </span>
                  <Check className="mt-0.5 size-[13px] flex-none text-[var(--teal)]" aria-hidden />
                </div>
              ))}
            </div>
          </Section>
        ) : null}
      </div>

      <div className="border-t border-[var(--border-hairline)] px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3.5">
        <button
          type="button"
          disabled={!ready}
          onClick={() => onSave(form, mirror ? pairId : null)}
          className="inline-flex h-[52px] w-full items-center justify-center rounded-full border border-[var(--eb-teal-a40)] bg-[var(--eb-teal-500)] text-base font-medium text-[var(--eb-plum-900)] transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
        >
          {mirror && pair ? "Salvar nas duas regiões" : "Salvar marcação"}
        </button>
        {!ready ? (
          <p className="mt-2.5 text-center text-[11.5px] text-muted-foreground">
            Escolha um procedimento, produto, ação ou observação para salvar.
          </p>
        ) : null}
        {alreadySaved || pointCount ? (
          <Button type="button" variant="ghost" className="mt-2 w-full" onClick={onClear}>
            Remover marcação desta região
          </Button>
        ) : null}
      </div>
    </div>
  );
}
