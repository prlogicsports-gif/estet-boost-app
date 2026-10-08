import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AlertCard } from "@/components/eb/alert-card";
import { CashSummary, type CashKind } from "@/components/eb/cash-summary";
import { Icon } from "@/components/eb/icon";
import { MetricCard } from "@/components/eb/metric-card";
import { Drawer } from "@/components/eb/overlays";
import { SearchBar } from "@/components/eb/search-bar";
import { SegmentedTabs } from "@/components/eb/segmented-tabs";
import { StatusBadge } from "@/components/eb/status-badge";
import { StockItem } from "@/components/eb/stock-item";
import { TopBar } from "@/components/eb/top-bar";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { bills, ledger, moves, pro, stock, type LedgerEntry } from "@/data/gestor-mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_gestor/gestao")({
  head: () => ({
    meta: [
      { title: "Gestão — EstetBoost." },
      {
        name: "description",
        content: "Acompanhe caixa, serviços e indicadores do seu negócio de estética.",
      },
      { property: "og:title", content: "Gestão — EstetBoost." },
      {
        property: "og:description",
        content: "Acompanhe caixa, serviços e indicadores do seu negócio de estética.",
      },
    ],
  }),
  component: GestaoPage,
});

const brl = (value: number) => `R$ ${Math.round(value).toLocaleString("pt-BR")}`;

// O resumo do mês é a soma do livro-caixa, para o número e o detalhe nunca divergirem.
const MONTH = "2026-08";
const ofPeriod = (list: LedgerEntry[]) =>
  list.filter((entry) => entry.kind === "receber" || entry.date.slice(0, 7) >= MONTH);
const sum = (list: LedgerEntry[], kind: CashKind) =>
  list.filter((entry) => entry.kind === kind).reduce((total, entry) => total + entry.value, 0);

const KINDS: Record<
  CashKind,
  { title: string; sub: string; icon: string; color: string; sign: string }
> = {
  entradas: {
    title: "Entradas",
    sub: "O que entrou no caixa",
    icon: "ArrowDownLeft",
    color: "var(--eb-teal-500)",
    sign: "+ ",
  },
  saidas: {
    title: "Saídas",
    sub: "O que saiu do caixa",
    icon: "ArrowUpRight",
    color: "var(--eb-coral-500)",
    sign: "- ",
  },
  receber: {
    title: "A receber",
    sub: "Valores combinados que ainda não entraram",
    icon: "Hourglass",
    color: "var(--eb-amber-500)",
    sign: "",
  },
};

const longDate = (iso: string) => {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const monthName = (key: string) => {
  const text = new Date(`${key}-15T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function CashDetail({ kind, onClose }: { kind: CashKind | null; onClose: () => void }) {
  const [all, setAll] = useState(false);
  const [method, setMethod] = useState("todos");
  const meta = KINDS[kind ?? "entradas"];
  const base = (all ? ledger : ofPeriod(ledger)).filter(
    (entry) => entry.kind === (kind ?? "entradas"),
  );
  const methods = Array.from(new Set(base.map((entry) => entry.method)));
  const list = base
    .filter((entry) => method === "todos" || entry.method === method)
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = list.reduce((acc, entry) => acc + entry.value, 0);
  const groups: { month: string; items: LedgerEntry[] }[] = [];
  for (const entry of list) {
    const key = entry.date.slice(0, 7);
    const group = groups.find((item) => item.month === key);
    if (group) group.items.push(entry);
    else groups.push({ month: key, items: [entry] });
  }

  return (
    <Drawer
      open={Boolean(kind)}
      onClose={onClose}
      title={meta.title}
      subtitle={meta.sub}
      width={480}
      footer={
        <Button
          type="button"
          variant={all ? "ghost" : "secondary"}
          className="w-full"
          onClick={() => setAll((value) => !value)}
        >
          <Icon name={all ? "CalendarRange" : "History"} size={18} />
          {all ? "Mostrar só o período atual" : "Ver histórico completo"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] px-4 py-3.5">
          <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
            {all ? "Todo o histórico" : "Agosto e setembro"}
          </span>
          <div
            className="mt-1 font-mono text-[34px] font-medium tracking-[-0.02em]"
            style={{ color: meta.color }}
          >
            {brl(total)}
          </div>
          <div className="text-[12.5px] text-[var(--text-secondary)]">
            {list.length} {list.length === 1 ? "lançamento" : "lançamentos"}
            {method !== "todos" ? ` · ${method}` : ""}
          </div>
        </div>

        {methods.length > 1 ? (
          <div className="flex gap-1.5 overflow-x-auto">
            {["todos", ...methods].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMethod(item)}
                className={cn(
                  "min-h-11 flex-none whitespace-nowrap rounded-full border px-[13px] text-[12.5px]",
                  method === item
                    ? "border-transparent bg-[var(--eb-nude-500)] text-[var(--text-on-nude)]"
                    : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] text-[var(--text-secondary)]",
                )}
              >
                {item === "todos" ? "Todas as formas" : item}
              </button>
            ))}
          </div>
        ) : null}

        {groups.map((group) => (
          <div key={group.month} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2.5 border-b border-[var(--border-hairline)] pb-1.5">
              <span className="flex-1 text-[13.5px] font-medium">{monthName(group.month)}</span>
              <span className="font-mono text-[12.5px] text-muted-foreground">
                {brl(group.items.reduce((acc, entry) => acc + entry.value, 0))}
              </span>
            </div>
            {group.items.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] px-3 py-2.5"
              >
                <span
                  className="grid size-[30px] flex-none place-items-center rounded-full bg-[var(--surface-card)]"
                  style={{ color: meta.color }}
                >
                  <Icon name={meta.icon} size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{entry.label}</div>
                  <div className="text-[12.5px] text-[var(--text-secondary)]">{entry.origin}</div>
                  <div className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">
                    {kind === "receber"
                      ? `Vence ${longDate(entry.due ?? entry.date)}`
                      : longDate(entry.date)}{" "}
                    · {entry.method}
                  </div>
                </div>
                <span
                  className="whitespace-nowrap font-mono text-[14.5px] font-medium"
                  style={{ color: meta.color }}
                >
                  {meta.sign}
                  {brl(entry.value)}
                </span>
              </div>
            ))}
          </div>
        ))}
        {!list.length ? (
          <p className="text-[13px] text-muted-foreground">Nenhum lançamento nesse filtro.</p>
        ) : null}
      </div>
    </Drawer>
  );
}

type Tab = "caixa" | "contas" | "estoque";

function GestaoPage() {
  const { openNotifications, unread } = useShell();
  const [tab, setTab] = useState<Tab>("caixa");
  const [detail, setDetail] = useState<CashKind | null>(null);
  const period = ofPeriod(ledger);
  const income = sum(period, "entradas");
  const expense = sum(period, "saidas");
  const receivable = sum(period, "receber");

  return (
    <div className="flex flex-col gap-4">
      <TopBar
        title="Gestão"
        context="Setembro de 2026"
        notifications={unread}
        user={pro}
        onNotifications={openNotifications}
        actions={
          <Button type="button" size="sm">
            <Icon name="Plus" size={15} />
            {tab === "caixa"
              ? "Nova movimentação"
              : tab === "contas"
                ? "Adicionar conta"
                : "Adicionar produto"}
          </Button>
        }
      />
      <SegmentedTabs<Tab>
        active={tab}
        onSelect={setTab}
        tabs={[
          { id: "caixa", label: "Caixa" },
          { id: "contas", label: "Contas" },
          { id: "estoque", label: "Estoque" },
        ]}
      />

      {tab === "caixa" ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] items-start gap-4">
          <CashSummary
            balance={brl(income - expense)}
            income={brl(income)}
            expense={brl(expense)}
            receivable={brl(receivable)}
            goal="R$ 6.000"
            goalProgress={Math.min(1, income / 6000)}
            onSelect={setDetail}
          />
          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
              Últimas movimentações
            </span>
            {moves.map((move) => (
              <div
                key={`${move.label}-${move.when}`}
                className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-3"
              >
                <span className="flex-1 text-[13.5px]">
                  {move.label}
                  <span className="block text-[11.5px] text-muted-foreground">{move.when}</span>
                </span>
                <span
                  className="font-mono text-sm font-medium"
                  style={{
                    color: move.kind === "in" ? "var(--eb-teal-500)" : "var(--eb-coral-500)",
                  }}
                >
                  {move.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "contas" ? (
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            <MetricCard label="A pagar no mês" value="R$ 1.147" icon="Receipt" tone="warn" />
            <MetricCard label="Vencendo em 7 dias" value="2" icon="CalendarClock" tone="danger" />
            <MetricCard label="Pagas" value="1" icon="CheckCheck" tone="tech" />
          </div>
          {bills.map((bill) => (
            <div
              key={bill.name}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{bill.name}</div>
                <div className="text-[11.5px] text-muted-foreground">
                  Vence {bill.due} · {bill.recurrence} · lembrete 2 dias antes
                </div>
              </div>
              <span className="font-mono text-sm font-medium">{bill.value}</span>
              <StatusBadge tone={bill.status} size="sm">
                {bill.status === "confirmed"
                  ? "Paga"
                  : bill.status === "pending"
                    ? "A pagar"
                    : "Atrasada"}
              </StatusBadge>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "estoque" ? (
        <div className="flex flex-col gap-2.5">
          <SearchBar placeholder="Buscar produto" />
          <AlertCard
            tone="warn"
            icon="PackageMinus"
            title="2 produtos abaixo do mínimo"
            description="Ácido mandélico 5% e máscara calmante"
            actionLabel="Repor"
          />
          {stock.map((item) => (
            <StockItem key={item.name} {...item} />
          ))}
        </div>
      ) : null}

      <CashDetail kind={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
