import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  Check,
  ChevronRight,
  Hand,
  type LucideIcon,
  MessageCircle,
  Milk,
  Minus,
  Plus,
  Sparkles,
  X,
} from "lucide-react";

import type { FaceZone } from "@/components/facemap/face-data";
import { ProductDrawer } from "@/components/eb/product-drawer";
import { NewProcedureForm } from "@/components/session/new-procedure-form";
import { Button } from "@/components/ui/button";
import { proceduresDb, stockDb } from "@/data/db";
import { useFaceLayout } from "@/lib/face-layout";
import {
  emptyRecord,
  productLabel,
  summarizeMark,
  type FaceMark,
  type FaceRecord,
} from "@/lib/face-map-store";
import { can, usableProcedures } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import { daysToExpire } from "@/components/eb/stock-item";
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
            "block break-words text-[15px]",
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
              "min-h-[38px] max-w-full break-words rounded-full border px-3.5 py-1.5 text-left text-[13px] leading-snug transition-colors",
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
  pair: pairOverride,
  procedures,
  actions,
  onClose,
  onSave,
  onClear,
}: {
  zone: FaceZone | null;
  pointCount: number;
  history: FaceMark[];
  /** Mapas de corpo: a região do lado oposto (`null` = não tem). Sem isso vale o layout do rosto. */
  pair?: { id: string; nome: string } | null;
  /** Procedimentos e ações sugeridos para este mapa (os do catálogo entram primeiro). */
  procedures?: string[];
  actions?: string[];
  onClose: () => void;
  onSave: (record: FaceRecord, pairId: string | null) => void;
  onClear: () => void;
}) {
  const layout = useFaceLayout();
  const me = useSession();
  const catalog = usableProcedures(me, proceduresDb.use());
  const stock = stockDb.use();
  const isGestor = me?.role === "gestor";
  const canStock = can(me, "estoque");
  const [creatingProc, setCreatingProc] = useState(false);
  const [other, setOther] = useState("");
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [row, setRow] = useState<RowKey | null>(null);
  const [form, setForm] = useState<FaceRecord>(emptyRecord);
  const [mirror, setMirror] = useState(false);
  const zoneId = zone?.id;

  useEffect(() => {
    setRow(null);
    setForm(emptyRecord);
    setMirror(false);
    setCreatingProc(false);
    setOther("");
    setCreatingProduct(false);
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
  const usesProduct = form.usouProduto === true;
  const pickProduct = (item: { id: string; name: string }) =>
    setForm((current) => ({
      ...current,
      usouProduto: true,
      produto: item.name,
      produtoId: item.id,
      produtoQtd: current.produtoId === item.id ? (current.produtoQtd ?? 1) : 1,
    }));
  const setProductUse = (uses: boolean) =>
    setForm((current) => ({
      ...current,
      usouProduto: uses,
      ...(uses ? {} : { produto: "", produtoId: undefined, produtoQtd: undefined }),
    }));
  const changeQty = (by: number) =>
    setForm((current) => ({
      ...current,
      produtoQtd: Math.max(1, (current.produtoQtd ?? 1) + by),
    }));
  const pairId = pairOverride !== undefined ? (pairOverride?.id ?? null) : layout.pairOf(zone.id);
  const pairName =
    pairOverride !== undefined
      ? (pairOverride?.nome ?? null)
      : pairId && layout.zoneById(pairId)
        ? layout.nameOf(pairId)
        : null;
  const procedureOptions = Array.from(
    new Set([...catalog.map((item) => item.name), ...(procedures ?? PROCEDIMENTOS)]),
  );
  const actionOptions = actions ?? ACOES;
  const alreadySaved = history.length > 0;

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Registro em ${zone.nome}`}
      className={cn(
        "relative flex min-w-0 flex-col border border-[var(--glass-border)] bg-[var(--glass-bg-strong)] backdrop-blur-[22px] backdrop-saturate-[1.15]",
        "max-h-[90dvh] w-full max-w-[700px] rounded-[var(--radius-2xl)]",
      )}
      style={{
        boxShadow: "var(--glass-shadow), var(--glass-highlight)",
        animation: "fade-up 280ms cubic-bezier(.16,1,.3,1)",
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-5">
        <div className="flex items-start gap-3">
          <h2 className="min-w-0 flex-1 break-words text-[22px] font-medium leading-[1.2] tracking-[-0.015em] text-foreground sm:text-[26px]">
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
            <>
              <Options
                items={procedureOptions}
                value={form.procedimento}
                onPick={(v) => set("procedimento", v)}
              />
              <div className="flex flex-col gap-2.5 px-4 pb-4">
                {isGestor ? (
                  creatingProc ? (
                    <NewProcedureForm
                      onCancel={() => setCreatingProc(false)}
                      onCreate={(rec) => {
                        set("procedimento", rec.name);
                        setCreatingProc(false);
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCreatingProc(true)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 self-start rounded-full border border-dashed border-[var(--border-hairline)] px-3.5 text-[13px] text-[var(--text-secondary)]"
                    >
                      <Plus className="size-3.5" aria-hidden /> Criar procedimento (fica no
                      catálogo)
                    </button>
                  )
                ) : (
                  <label className="flex flex-col gap-1.5 text-[12.5px] text-[var(--text-secondary)]">
                    Outro (só neste registro)
                    <input
                      value={other}
                      placeholder="Nome do procedimento"
                      onChange={(event) => {
                        setOther(event.target.value);
                        set("procedimento", event.target.value);
                      }}
                      className="min-h-11 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-field)] px-3.5 text-[14px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                )}
              </div>
            </>
          ) : null}
          <Row
            icon={Milk}
            label="Produto"
            value={productLabel(form)}
            open={row === "produto"}
            onClick={() => toggle("produto")}
          />
          {row === "produto" ? (
            <div className="flex flex-col gap-3 px-4 pb-4 pt-1">
              <div role="group" aria-label="Usou produto?" className="flex items-center gap-2">
                <span className="mr-1 text-[13px] text-[var(--text-secondary)]">Usou produto?</span>
                {([true, false] as const).map((uses) => {
                  const on = form.usouProduto === uses;
                  return (
                    <button
                      key={String(uses)}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setProductUse(uses)}
                      className={cn(
                        "min-h-[38px] min-w-16 rounded-full border px-3.5 text-[13px] transition-colors",
                        on
                          ? "border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a24)] text-foreground"
                          : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] text-[var(--text-secondary)]",
                      )}
                    >
                      {uses ? "Sim" : "Não"}
                    </button>
                  );
                })}
              </div>
              {usesProduct ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {stock.map((item) => {
                      const on = form.produtoId === item.id;
                      const days = daysToExpire(item);
                      const expired = days !== null && days < 0;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => pickProduct(item)}
                          className={cn(
                            "min-h-[38px] max-w-full break-words rounded-full border px-3.5 py-1.5 text-left text-[13px] leading-snug transition-colors",
                            on
                              ? "border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a24)] text-foreground"
                              : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] text-[var(--text-secondary)]",
                          )}
                        >
                          {item.name}
                          <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                            {item.quantity} {item.unit}
                            {expired ? " · vencido" : ""}
                          </span>
                        </button>
                      );
                    })}
                    {canStock ? (
                      <button
                        type="button"
                        onClick={() => setCreatingProduct(true)}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-dashed border-[var(--border-hairline)] px-3.5 text-[13px] text-[var(--text-secondary)]"
                      >
                        <Plus className="size-3.5" aria-hidden /> Criar produto
                      </button>
                    ) : null}
                  </div>
                  {!stock.length ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhum produto no estoque ainda.
                      {canStock ? " Use “Criar produto”." : ""}
                    </p>
                  ) : null}
                  {form.produtoId ? (
                    <div className="flex items-center gap-2 text-[13px]">
                      <span className="text-[var(--text-secondary)]">Quantidade</span>
                      <button
                        type="button"
                        aria-label="Menos"
                        onClick={() => changeQty(-1)}
                        className="grid size-9 place-items-center rounded-full border border-[var(--border-card)] bg-[var(--eb-ivory-a06)]"
                      >
                        <Minus className="size-4" aria-hidden />
                      </button>
                      <span className="w-6 text-center font-mono">{form.produtoQtd ?? 1}</span>
                      <button
                        type="button"
                        aria-label="Mais"
                        onClick={() => changeQty(1)}
                        className="grid size-9 place-items-center rounded-full border border-[var(--border-card)] bg-[var(--eb-ivory-a06)]"
                      >
                        <Plus className="size-4" aria-hidden />
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
          <Row
            icon={Hand}
            label="Ação"
            value={form.acao}
            open={row === "acao"}
            onClick={() => toggle("acao")}
          />
          {row === "acao" ? (
            <Options items={actionOptions} value={form.acao} onPick={(v) => set("acao", v)} />
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

        {pairName ? (
          <label className="mt-3.5 flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={mirror}
              onChange={(event) => setMirror(event.target.checked)}
              className="mt-0.5 size-[18px] flex-none accent-[var(--teal)]"
            />
            <span className="min-w-0 flex-1 break-words text-[13px] leading-[1.45] text-[var(--text-secondary)]">
              Registrar também no lado oposto: {pairName}
            </span>
          </label>
        ) : null}

        <p className="mt-[18px] flex items-start gap-2 text-[12.5px] leading-[1.45] text-muted-foreground">
          <Camera className="mt-0.5 size-[14px] flex-none" aria-hidden />
          <span className="min-w-0 flex-1">
            As fotos ficam na aba <strong className="font-medium text-foreground">Fotos</strong> do
            perfil da cliente.
          </span>
        </p>

        {history.length ? (
          <Section title={`Histórico desta região · ${history.length}`}>
            <div className="mt-2 flex flex-col gap-1.5">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2.5 rounded-[var(--radius-sm)] bg-[var(--eb-ivory-a06)] px-3 py-2.5 text-[12.5px]"
                >
                  <span className="flex-none font-mono text-muted-foreground">{item.date}</span>
                  <span className="min-w-0 flex-1 break-words text-[var(--text-secondary)]">
                    {summarizeMark(item) || item.observacao || "Registro"}
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
          {mirror && pairName ? "Salvar nas duas regiões" : "Salvar marcação"}
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

  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
        <div
          onClick={onClose}
          className="absolute inset-0 bg-[rgba(20,14,17,.58)]"
          style={{ animation: "fade-in 280ms cubic-bezier(.16,1,.3,1)" }}
        />
        {dialog}
      </div>
      <ProductDrawer
        layer
        open={creatingProduct}
        item={null}
        mode="novo"
        onClose={() => setCreatingProduct(false)}
        onCreated={pickProduct}
        onSaved={() => setCreatingProduct(false)}
      />
    </>,
    document.body,
  );
}
