import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AlertCard } from "@/components/eb/alert-card";
import { CashSummary, type CashKind } from "@/components/eb/cash-summary";
import { Icon } from "@/components/eb/icon";
import { IconButton } from "@/components/eb/icon-button";
import { Input } from "@/components/eb/input";
import { MetricCard } from "@/components/eb/metric-card";
import { Drawer } from "@/components/eb/overlays";
import { SearchBar } from "@/components/eb/search-bar";
import { SegmentedTabs } from "@/components/eb/segmented-tabs";
import { Select } from "@/components/eb/select";
import { StatusBadge } from "@/components/eb/status-badge";
import { daysToExpire, StockItem } from "@/components/eb/stock-item";
import { ToastHost } from "@/components/eb/toast";
import { TopBar } from "@/components/eb/top-bar";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { activityDb, billsDb, ledgerDb, stockDb } from "@/data/db";
import type { LedgerEntry } from "@/lib/models";
import { useClinicClients } from "@/lib/use-clinic";
import { can } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import { usePro } from "@/lib/use-pro";
import { addDays, daysBetween, formatShort, monthName, relativeDay, todayISO } from "@/lib/dates";
import { brl } from "@/lib/view";
import { cn } from "@/lib/utils";
import type { ActivityRec, BillRec, StockRec } from "@/lib/models";
import {
  addBill,
  addLedgerEntry,
  confirmPayment,
  payBill,
  removeBill,
  removeLedgerEntry,
  reopenBill,
  reopenReceivable,
  updateBill,
  updateLedgerEntry,
  rejectPayment,
  removeStock,
  saveStock,
} from "@/services/finance.service";

type Tab = "caixa" | "receber" | "contas" | "estoque" | "historico";
const TABS: Tab[] = ["caixa", "receber", "contas", "estoque", "historico"];

export const Route = createFileRoute("/_gestor/gestao")({
  validateSearch: (search): { aba?: Tab | undefined } => ({
    aba: TABS.find((item) => item === search["aba"]),
  }),
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

// O resumo é a soma do livro-caixa do mês anterior e do atual, para o número e o detalhe nunca divergirem.
const periodStart = () => `${addDays(todayISO().slice(0, 8) + "01", -1).slice(0, 7)}`;
const ofPeriod = (list: LedgerEntry[]) =>
  list.filter((entry) => entry.kind === "receber" || entry.date.slice(0, 7) >= periodStart());
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

const METHODS = [
  "Pix",
  "Cartão de crédito",
  "Cartão de débito",
  "Dinheiro",
  "Transferência",
  "Boleto",
];

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

function CashDetail({
  kind,
  onClose,
  onEdit,
}: {
  kind: CashKind | null;
  onClose: () => void;
  onEdit: (entry: LedgerEntry) => void;
}) {
  const ledger = ledgerDb.use();
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
            {all ? "Todo o histórico" : "Mês anterior e atual"}
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
              <span className="flex-1 text-[13.5px] font-medium">
                {monthName(`${group.month}-15`)}
              </span>
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
                <IconButton
                  icon="PencilLine"
                  label={`Corrigir ${entry.label}`}
                  onClick={() => onEdit(entry)}
                />
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

type Sheet = "movimento" | "conta" | "produto" | null;

function GestaoPage() {
  const pro = usePro();
  const { openNotifications, unread } = useShell();
  const ledger = ledgerDb.use();
  const bills = billsDb.use();
  const stock = stockDb.use();
  const { aba } = Route.useSearch();
  const session = useSession();
  const allowed: Tab[] = [
    ...(can(session, "financeiro") ? (["caixa", "receber", "contas"] as Tab[]) : []),
    ...(can(session, "estoque") ? (["estoque"] as Tab[]) : []),
    ...(can(session, "historico") ? (["historico"] as Tab[]) : []),
  ];
  const [chosen, setTab] = useState<Tab>(aba ?? "caixa");
  const tab: Tab = allowed.includes(chosen) ? chosen : (allowed[0] ?? "caixa");
  useEffect(() => {
    if (aba) setTab(aba);
  }, [aba]);
  const [detail, setDetail] = useState<CashKind | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [editEntry, setEditEntry] = useState<LedgerEntry | null>(null);
  const [editBill, setEditBill] = useState<BillRec | null>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [product, setProduct] = useState<{
    item: StockRec | null;
    mode: "novo" | "editar" | "repor";
  }>({ item: null, mode: "novo" });
  const today = todayISO();

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const period = ofPeriod(ledger);
  const income = sum(period, "entradas");
  const expense = sum(period, "saidas");
  const receivable = sum(period, "receber");
  const moves = useMemo(
    () =>
      ledger
        .filter((entry) => entry.kind !== "receber")
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 6),
    [ledger],
  );
  const orderedBills = [...bills].sort(
    (a, b) => Number(a.paid) - Number(b.paid) || a.due.localeCompare(b.due),
  );
  const openBills = bills.filter((bill) => !bill.paid);
  const low = stock.filter((item) => item.quantity <= item.min);
  const shown = stock
    .filter((item) =>
      `${item.name} ${item.category} ${item.supplier}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const expiring = stock.filter((item) => {
    const days = daysToExpire(item);
    return days !== null && days <= 30;
  });
  const pendingReceivables = ledger.filter((entry) => entry.kind === "receber");
  const reportedCount = pendingReceivables.filter((entry) => entry.reported).length;

  const addLabel =
    tab === "caixa" || tab === "receber"
      ? "Nova movimentação"
      : tab === "contas"
        ? "Adicionar conta"
        : "Adicionar produto";
  const openAdd = () => {
    setProduct({ item: null, mode: "novo" });
    setEditEntry(null);
    setEditBill(null);
    setSheet(
      tab === "caixa" || tab === "receber" ? "movimento" : tab === "contas" ? "conta" : "produto",
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <TopBar
        title="Gestão"
        context={monthName(today)}
        notifications={unread}
        user={pro}
        onNotifications={openNotifications}
        actions={
          <Button type="button" size="sm" onClick={openAdd}>
            <Icon name="Plus" size={15} />
            {addLabel}
          </Button>
        }
      />
      <SegmentedTabs<Tab>
        active={tab}
        onSelect={setTab}
        tabs={(
          [
            { id: "caixa", label: "Caixa" },
            { id: "receber", label: reportedCount ? `A receber · ${reportedCount}` : "A receber" },
            { id: "contas", label: "Contas" },
            { id: "estoque", label: "Estoque" },
            { id: "historico", label: "Histórico" },
          ] as { id: Tab; label: string }[]
        ).filter((item) => allowed.includes(item.id))}
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
                key={move.id}
                className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-3"
              >
                <span className="min-w-0 flex-1 text-[13.5px]">
                  <span className="block truncate">
                    {move.label} · {move.origin}
                  </span>
                  <span className="block text-[11.5px] text-muted-foreground">
                    {relativeDay(move.date)}
                  </span>
                </span>
                <span
                  className="font-mono text-sm font-medium"
                  style={{
                    color: move.kind === "entradas" ? "var(--eb-teal-500)" : "var(--eb-coral-500)",
                  }}
                >
                  {move.kind === "entradas" ? "+ " : "- "}
                  {brl(move.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "receber" ? (
        <div className="flex flex-col gap-2.5">
          {reportedCount ? (
            <AlertCard
              tone="info"
              icon="Wallet"
              title={`${reportedCount} ${reportedCount === 1 ? "pagamento informado" : "pagamentos informados"} pela cliente`}
              description="Confira no seu banco e confirme: o valor entra no caixa e a cliente é avisada."
            />
          ) : null}
          {pendingReceivables
            .sort(
              (a, b) =>
                Number(Boolean(b.reported)) - Number(Boolean(a.reported)) ||
                (a.due ?? a.date).localeCompare(b.due ?? b.date),
            )
            .map((entry) => {
              const days = daysBetween(today, entry.due ?? entry.date);
              return (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-3"
                >
                  <div className="min-w-[160px] flex-1">
                    <div className="text-sm font-medium">{entry.label}</div>
                    <div className="text-[12.5px] text-[var(--text-secondary)]">{entry.origin}</div>
                    <div className="font-mono text-[11.5px] text-muted-foreground">
                      {entry.reported
                        ? `Informou ${entry.reported.method} em ${formatShort(entry.reported.at.slice(0, 10))}`
                        : days < 0
                          ? `Venceu há ${-days} ${-days === 1 ? "dia" : "dias"}`
                          : `Vence ${formatShort(entry.due ?? entry.date)}`}
                    </div>
                  </div>
                  <span className="font-mono text-sm font-medium">{brl(entry.value)}</span>
                  {entry.reported ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          rejectPayment(entry.id);
                          setToast("Cliente avisada: pagamento não localizado");
                        }}
                      >
                        Não recebi
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="tech"
                        onClick={() => {
                          confirmPayment(entry.id);
                          setToast(`${brl(entry.value)} confirmado e lançado no caixa`);
                        }}
                      >
                        <Icon name="Check" size={15} /> Confirmar recebimento
                      </Button>
                    </>
                  ) : (
                    <>
                      <StatusBadge tone={days < 0 ? "cancelled" : "pending"} size="sm">
                        {days < 0 ? "Atrasado" : "Em aberto"}
                      </StatusBadge>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          confirmPayment(entry.id);
                          setToast(`${brl(entry.value)} recebido e lançado no caixa`);
                        }}
                      >
                        Marcar recebido
                      </Button>
                    </>
                  )}
                  <IconButton
                    icon="PencilLine"
                    label={`Corrigir ${entry.label}`}
                    onClick={() => (setEditEntry(entry), setSheet("movimento"))}
                  />
                </div>
              );
            })}
          {!pendingReceivables.length ? (
            <p className="py-2 text-[13px] text-muted-foreground">Nada a receber por enquanto.</p>
          ) : null}
        </div>
      ) : null}

      {tab === "contas" ? (
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            <MetricCard
              label="A pagar"
              value={brl(openBills.reduce((total, bill) => total + bill.value, 0))}
              icon="Receipt"
              tone="warn"
            />
            <MetricCard
              label="Vencendo em 7 dias"
              value={
                openBills.filter(
                  (bill) => daysBetween(today, bill.due) >= 0 && daysBetween(today, bill.due) <= 7,
                ).length
              }
              icon="CalendarClock"
              tone="danger"
            />
            <MetricCard
              label="Pagas"
              value={bills.filter((bill) => bill.paid).length}
              icon="CheckCheck"
              tone="tech"
            />
          </div>
          {orderedBills.map((bill) => {
            const days = daysBetween(today, bill.due);
            const late = !bill.paid && days < 0;
            return (
              <div
                key={bill.id}
                className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-3"
              >
                <div className="min-w-[160px] flex-1">
                  <div className="text-sm font-medium">{bill.name}</div>
                  <div className="text-[11.5px] text-muted-foreground">
                    Vence {formatShort(bill.due)} · {bill.recurrence}
                    {bill.paid ? "" : " · lembrete diário nos 3 dias antes"}
                  </div>
                </div>
                <span className="font-mono text-sm font-medium">{brl(bill.value)}</span>
                <StatusBadge
                  tone={bill.paid ? "confirmed" : late ? "cancelled" : "pending"}
                  size="sm"
                >
                  {bill.paid ? "Paga" : late ? "Atrasada" : "A pagar"}
                </StatusBadge>
                {bill.paid ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      reopenBill(bill.id);
                      setToast(`${bill.name} voltou para a pagar e saiu do caixa`);
                    }}
                  >
                    Desfazer pagamento
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      payBill(bill.id);
                      setToast(`${bill.name} paga e lançada no caixa`);
                    }}
                  >
                    Marcar como paga
                  </Button>
                )}
                <IconButton
                  icon="PencilLine"
                  label={`Corrigir ${bill.name}`}
                  onClick={() => (setEditBill(bill), setSheet("conta"))}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {tab === "historico" ? <ActivityList /> : null}

      {tab === "estoque" ? (
        <div className="flex flex-col gap-2.5">
          <SearchBar
            placeholder="Buscar produto"
            value={query}
            onChange={setQuery}
            onClear={() => setQuery("")}
          />
          {low.length ? (
            <AlertCard
              tone="warn"
              icon="PackageMinus"
              title={`${low.length} ${low.length === 1 ? "produto abaixo do mínimo" : "produtos abaixo do mínimo"}`}
              description={low.map((item) => item.name).join(" e ")}
              actionLabel="Repor"
              onAction={() => (
                setProduct({ item: low[0] ?? null, mode: "repor" }),
                setSheet("produto")
              )}
            />
          ) : null}
          {expiring.length ? (
            <AlertCard
              tone="danger"
              icon="CalendarX"
              title={`${expiring.length} ${expiring.length === 1 ? "produto vencido ou perto de vencer" : "produtos vencidos ou perto de vencer"}`}
              description={expiring.map((item) => item.name).join(", ")}
            />
          ) : null}
          {shown.map((item) => (
            <StockItem
              key={item.id}
              item={item}
              onEdit={() => {
                setProduct({ item, mode: "editar" });
                setSheet("produto");
              }}
              onRestock={() => {
                setProduct({ item, mode: "repor" });
                setSheet("produto");
              }}
            />
          ))}
          {!shown.length ? (
            <p className="py-2 text-[13px] text-muted-foreground">Nenhum produto com esse nome.</p>
          ) : null}
        </div>
      ) : null}

      <CashDetail
        kind={detail}
        onClose={() => setDetail(null)}
        onEdit={(entry) => {
          setDetail(null);
          setEditEntry(entry);
          setSheet("movimento");
        }}
      />
      <MovementDrawer
        open={sheet === "movimento"}
        entry={editEntry}
        onClose={() => setSheet(null)}
        onSaved={(text) => (setSheet(null), setToast(text))}
      />
      <BillDrawer
        open={sheet === "conta"}
        bill={editBill}
        onClose={() => setSheet(null)}
        onSaved={(text) => (setSheet(null), setToast(text))}
      />
      <ProductDrawer
        open={sheet === "produto"}
        item={product.item}
        mode={product.mode}
        onClose={() => setSheet(null)}
        onSaved={(text) => (setSheet(null), setToast(text))}
      />
      <ToastHost toast={toast ? { message: toast } : null} />
    </div>
  );
}

const drawerFooter = (onClose: () => void, submit: () => void, text: string) => (
  <>
    <Button type="button" variant="ghost" onClick={onClose}>
      Cancelar
    </Button>
    <Button type="button" variant="tech" className="flex-1" onClick={submit}>
      <Icon name="Check" size={18} /> {text}
    </Button>
  </>
);

const parseMoney = (text: string) => Number(text.replace(/\./g, "").replace(",", "."));

function MovementDrawer({
  open,
  entry,
  onClose,
  onSaved,
}: {
  open: boolean;
  entry: LedgerEntry | null;
  onClose: () => void;
  onSaved: (text: string) => void;
}) {
  const [kind, setKind] = useState<"entradas" | "saidas" | "receber">("entradas");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [method, setMethod] = useState(METHODS[0] ?? "Pix");
  const [date, setDate] = useState(todayISO());
  const [tried, setTried] = useState(false);
  const clients = useClinicClients();
  const [owner, setOwner] = useState("");

  useEffect(() => {
    if (!open) return;
    setOwner(entry?.clientId ?? "");
    setKind(entry?.kind ?? "entradas");
    setLabel(entry?.label ?? "");
    setValue(entry ? String(entry.value).replace(".", ",") : "");
    setMethod(entry?.method ?? METHODS[0] ?? "Pix");
    setDate(
      entry ? (entry.kind === "receber" ? (entry.due ?? entry.date) : entry.date) : todayISO(),
    );
    setTried(false);
  }, [open, entry]);

  const amount = parseMoney(value);
  const labelError = label.trim() ? undefined : "Descreva a movimentação.";
  const valueError = amount > 0 ? undefined : "Informe um valor maior que zero.";

  function submit() {
    setTried(true);
    if (labelError || valueError) return;
    if (entry) {
      updateLedgerEntry(entry.id, {
        kind,
        label: label.trim(),
        value: amount,
        method,
        date,
        ...(kind === "receber" ? { due: date } : {}),
        ...(owner ? { clientId: owner } : {}),
      });
      onSaved("Lançamento corrigido");
      return;
    }
    addLedgerEntry({
      kind,
      date,
      label: label.trim(),
      origin:
        kind === "entradas"
          ? "Entrada avulsa"
          : kind === "saidas"
            ? "Saída avulsa"
            : "Cobrança combinada",
      method,
      value: amount,
      ...(kind === "receber" ? { due: date } : {}),
      ...(owner ? { clientId: owner } : {}),
    });
    onSaved(
      `${kind === "entradas" ? "Entrada" : kind === "saidas" ? "Saída" : "Cobrança"} de ${brl(amount)} lançada`,
    );
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={entry ? "Corrigir lançamento" : "Nova movimentação"}
      subtitle={
        entry ? "A correção muda o caixa e os totais do mês" : "Entra no caixa e nos totais do mês"
      }
      footer={
        entry ? (
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (window.confirm("Apagar este lançamento do caixa?")) {
                  removeLedgerEntry(entry.id);
                  onSaved("Lançamento apagado");
                }
              }}
            >
              <Icon name="Trash2" size={16} /> Apagar
            </Button>
            {entry.kind === "entradas" && entry.due ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  reopenReceivable(entry.id);
                  onSaved("Recebimento desfeito: voltou para a receber");
                }}
              >
                Desfazer recebimento
              </Button>
            ) : null}
            <Button type="button" variant="tech" className="flex-1" onClick={submit}>
              <Icon name="Check" size={18} /> Salvar correção
            </Button>
          </>
        ) : (
          drawerFooter(onClose, submit, "Lançar")
        )
      }
    >
      <div className="flex flex-col gap-3.5">
        <SegmentedTabs
          active={kind}
          onSelect={setKind}
          tabs={[
            { id: "entradas", label: "Entrada" },
            { id: "saidas", label: "Saída" },
            { id: "receber", label: "A receber" },
          ]}
        />
        <Input
          label="Descrição"
          placeholder={kind === "saidas" ? "Compra de insumos" : "Venda de produto"}
          value={label}
          error={tried ? labelError : undefined}
          onChange={(event) => setLabel(event.target.value)}
        />
        <div className="grid grid-cols-2 gap-2.5">
          <Input
            label="Valor"
            trailing="R$"
            inputMode="decimal"
            value={value}
            error={tried ? valueError : undefined}
            onChange={(event) => setValue(event.target.value)}
          />
          <Input
            label={kind === "receber" ? "Vencimento" : "Data"}
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <Select
          label="Forma de pagamento"
          options={METHODS}
          value={method}
          onChange={(event) => setMethod(event.target.value)}
        />
        {kind === "receber" ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-[var(--text-secondary)]">
              Cliente (ela vê a cobrança e pode informar o pagamento)
            </span>
            <select
              value={owner}
              onChange={(event) => {
                setOwner(event.target.value);
                const picked = clients.find((item) => item.id === event.target.value);
                if (picked && !label.trim()) setLabel(picked.name);
              }}
              className="min-h-11 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-field)] px-3 text-[14.5px] text-foreground"
            >
              <option value="">Sem cliente vinculada</option>
              {clients.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </Drawer>
  );
}

function BillDrawer({
  open,
  bill,
  onClose,
  onSaved,
}: {
  open: boolean;
  bill: BillRec | null;
  onClose: () => void;
  onSaved: (text: string) => void;
}) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [due, setDue] = useState(addDays(todayISO(), 7));
  const [recurrence, setRecurrence] = useState<"Mensal" | "Avulsa">("Mensal");
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(bill?.name ?? "");
    setValue(bill ? String(bill.value).replace(".", ",") : "");
    setDue(bill?.due ?? addDays(todayISO(), 7));
    setRecurrence(bill?.recurrence ?? "Mensal");
    setTried(false);
  }, [open, bill]);

  const amount = parseMoney(value);
  const nameError = name.trim() ? undefined : "Dê um nome para a conta.";
  const valueError = amount > 0 ? undefined : "Informe um valor maior que zero.";

  function submit() {
    setTried(true);
    if (nameError || valueError || !due) return;
    if (bill) {
      updateBill(bill.id, { name: name.trim(), value: amount, due, recurrence });
      onSaved(`${name.trim()} corrigida`);
      return;
    }
    addBill({ name: name.trim(), value: amount, due, recurrence });
    onSaved(`${name.trim()} adicionada: você é avisada 3 dias antes`);
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={bill ? "Corrigir conta" : "Adicionar conta"}
      subtitle="O lembrete chega todo dia, de 3 dias antes até o vencimento"
      footer={
        bill ? (
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (window.confirm(`Apagar ${bill.name}?`)) {
                  removeBill(bill.id);
                  onSaved(`${bill.name} apagada`);
                }
              }}
            >
              <Icon name="Trash2" size={16} /> Apagar
            </Button>
            <Button type="button" variant="tech" className="flex-1" onClick={submit}>
              <Icon name="Check" size={18} /> Salvar correção
            </Button>
          </>
        ) : (
          drawerFooter(onClose, submit, "Adicionar conta")
        )
      }
    >
      <div className="flex flex-col gap-3.5">
        <Input
          label="Conta"
          placeholder="Aluguel da sala"
          value={name}
          error={tried ? nameError : undefined}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="grid grid-cols-2 gap-2.5">
          <Input
            label="Valor"
            trailing="R$"
            inputMode="decimal"
            value={value}
            error={tried ? valueError : undefined}
            onChange={(event) => setValue(event.target.value)}
          />
          <Input
            label="Vencimento"
            type="date"
            value={due}
            onChange={(event) => setDue(event.target.value)}
          />
        </div>
        <Select
          label="Recorrência"
          options={["Mensal", "Avulsa"]}
          value={recurrence}
          onChange={(event) => setRecurrence(event.target.value as "Mensal" | "Avulsa")}
        />
      </div>
    </Drawer>
  );
}

const CATEGORIES = ["Ativo", "Máscara", "Cosmético", "Descartável", "Equipamento", "Outro"];
const UNITS = ["un", "fr", "pt", "pc", "cx", "ml", "g", "kg"];

function ProductDrawer({
  open,
  item,
  mode,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: StockRec | null;
  mode: "novo" | "editar" | "repor";
  onClose: () => void;
  onSaved: (text: string) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0] ?? "");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("un");
  const [min, setMin] = useState("2");
  const [expiry, setExpiry] = useState("");
  const [batch, setBatch] = useState("");
  const [cost, setCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const [tried, setTried] = useState(false);
  const restocking = mode === "repor";

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? "");
    setCategory(item?.category ?? CATEGORIES[0] ?? "");
    setQuantity(item ? (restocking ? "1" : String(item.quantity)) : "1");
    setUnit(item?.unit ?? "un");
    setMin(String(item?.min ?? 2));
    setExpiry(item?.expiry ?? "");
    setBatch(item?.batch ?? "");
    setCost(item ? String(item.cost).replace(".", ",") : "");
    setSupplier(item?.supplier ?? "");
    setTried(false);
  }, [open, item, restocking]);

  const nameError = name.trim() ? undefined : "Informe o produto.";
  const qtyError =
    Number(quantity.replace(",", ".")) > 0 || (mode === "editar" && Number(quantity) >= 0)
      ? undefined
      : "Informe a quantidade.";

  function submit() {
    setTried(true);
    if (nameError || qtyError) return;
    const saved = saveStock(
      {
        ...(item ? { id: item.id } : {}),
        name: name.trim(),
        category,
        quantity: Number(quantity.replace(",", ".")),
        unit,
        min: Number(min) || 0,
        expiry,
        batch: batch.trim(),
        cost: parseMoney(cost) || 0,
        supplier: supplier.trim(),
      },
      restocking,
    );
    onSaved(
      restocking
        ? `${saved.name}: agora ${saved.quantity} ${saved.unit} no estoque`
        : `${saved.name} salvo no estoque`,
    );
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        restocking ? "Repor produto" : mode === "editar" ? "Editar produto" : "Adicionar produto"
      }
      subtitle={
        restocking
          ? "A quantidade informada é somada ao que já tem"
          : "Validade e mínimo geram avisos para você"
      }
      footer={
        <>
          {mode === "editar" && item ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                removeStock(item.id);
                onSaved(`${item.name} removido do estoque`);
              }}
            >
              <Icon name="Trash2" size={16} /> Excluir
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
          )}
          <Button type="button" variant="tech" className="flex-1" onClick={submit}>
            <Icon name="Check" size={18} /> {restocking ? "Registrar reposição" : "Salvar produto"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Input
          label="Produto"
          placeholder="Ácido mandélico 5%"
          value={name}
          disabled={restocking}
          error={tried ? nameError : undefined}
          onChange={(event) => setName(event.target.value)}
        />
        <Select
          label="Tipo"
          options={CATEGORIES}
          value={category}
          disabled={restocking}
          onChange={(event) => setCategory(event.target.value)}
        />
        <div className="grid grid-cols-3 gap-2.5">
          <Input
            label={restocking ? "Entrada" : "Quantidade"}
            inputMode="decimal"
            value={quantity}
            error={tried ? qtyError : undefined}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <Select
            label="Unidade"
            options={UNITS}
            value={unit}
            disabled={restocking}
            onChange={(event) => setUnit(event.target.value)}
          />
          <Input
            label="Mínimo"
            inputMode="numeric"
            value={min}
            onChange={(event) => setMin(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Input
            label="Validade"
            type="date"
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
          />
          <Input
            label="Lote"
            placeholder="A-2291"
            value={batch}
            onChange={(event) => setBatch(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Input
            label="Custo por unidade"
            trailing="R$"
            inputMode="decimal"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
            hint="Usado no cálculo de custo de cada atendimento."
          />
          <Input
            label="Fornecedor"
            placeholder="Dermaline"
            value={supplier}
            onChange={(event) => setSupplier(event.target.value)}
          />
        </div>
      </div>
    </Drawer>
  );
}

const ACTIVITY_FILTERS: { id: "todos" | ActivityRec["kind"]; label: string }[] = [
  { id: "todos", label: "Tudo" },
  { id: "horario", label: "Horários" },
  { id: "pagamento", label: "Pagamentos" },
  { id: "cadastro", label: "Cadastros" },
  { id: "atendimento", label: "Atendimentos" },
];
const ACTIVITY_ICON: Record<ActivityRec["kind"], string> = {
  horario: "CalendarClock",
  pagamento: "Wallet",
  cadastro: "UserPlus",
  atendimento: "Sparkles",
};

/** Tudo o que as clientes (e você) fizeram, do mais recente ao mais antigo. */
function ActivityList() {
  const session = useSession();
  const list = activityDb
    .use()
    .filter((item) => item.kind !== "pagamento" || can(session, "financeiro"));
  const [filter, setFilter] = useState<"todos" | ActivityRec["kind"]>("todos");
  const [who, setWho] = useState<"todos" | ActivityRec["by"]>("todos");
  const shown = list.filter(
    (item) => (filter === "todos" || item.kind === filter) && (who === "todos" || item.by === who),
  );
  const groups: { day: string; items: ActivityRec[] }[] = [];
  for (const item of shown) {
    const day = item.at.slice(0, 10);
    const group = groups.find((entry) => entry.day === day);
    if (group) group.items.push(item);
    else groups.push({ day, items: [item] });
  }
  const chip = (on: boolean) =>
    cn(
      "min-h-11 flex-none whitespace-nowrap rounded-full border px-[13px] text-[12.5px]",
      on
        ? "border-transparent bg-[var(--eb-nude-500)] text-[var(--text-on-nude)]"
        : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] text-[var(--text-secondary)]",
    );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5 overflow-x-auto">
        {ACTIVITY_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={chip(filter === item.id)}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
        <span className="mx-1 w-px flex-none bg-[var(--border-hairline)]" />
        {(["todos", "cliente", "gestor"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={chip(who === item)}
            onClick={() => setWho(item)}
          >
            {item === "todos"
              ? "Todos"
              : item === "cliente"
                ? "Feito pelas clientes"
                : "Feito por mim"}
          </button>
        ))}
      </div>
      {groups.map((group) => (
        <div key={group.day} className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
            {relativeDay(group.day)}
          </span>
          {group.items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-3"
            >
              <span className="grid size-8 flex-none place-items-center rounded-full bg-[var(--eb-ivory-a06)] text-[var(--eb-nude-300)]">
                <Icon name={ACTIVITY_ICON[item.kind]} size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px]">
                  <span className="font-medium">{item.client}</span> · {item.text}
                </div>
                <div className="font-mono text-[11.5px] text-muted-foreground">
                  {new Date(item.at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {item.by === "cliente" ? "pela cliente" : "por você"}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
      {!shown.length ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-card)] px-4 py-5 text-[13px] text-muted-foreground">
          Os pedidos de horário, confirmações, pagamentos informados, cadastros e atendimentos
          aparecem aqui conforme acontecem.
        </p>
      ) : null}
    </div>
  );
}
