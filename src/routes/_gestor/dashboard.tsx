import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { Icon } from "@/components/eb/icon";
import { Input } from "@/components/eb/input";
import { MetricCard } from "@/components/eb/metric-card";
import { Drawer } from "@/components/eb/overlays";
import { SegmentedTabs } from "@/components/eb/segmented-tabs";
import { daysToExpire } from "@/components/eb/stock-item";
import { TopBar } from "@/components/eb/top-bar";
import { Button } from "@/components/ui/button";
import {
  appointmentsDb,
  billsDb,
  blocksDb,
  clientsDb,
  hoursDb,
  ledgerDb,
  sessionsDb,
  settingsDb,
  stockDb,
} from "@/data/db";
import { addDays, monthName, todayISO } from "@/lib/dates";
import {
  average,
  change,
  doneAppointments,
  newClients,
  occupancy,
  periodRange,
  previousRange,
  returnShare,
  sumLedger,
  topProcedures,
  weeklyIncome,
  type PeriodId,
} from "@/lib/metrics";
import { usePro } from "@/lib/use-pro";
import { brl } from "@/lib/view";

export const Route = createFileRoute("/_gestor/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — EstetBoost." },
      {
        name: "description",
        content: "Faturamento, atendimentos, clientes e agenda do seu estúdio num só lugar.",
      },
    ],
  }),
  component: DashboardPage,
});

const heading =
  "text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground";
const card =
  "flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] p-4";

const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "mes", label: "Este mês" },
  { id: "anterior", label: "Mês passado" },
  { id: "30d", label: "30 dias" },
];

function trend(now: number, before: number) {
  const value = change(now, before);
  return value === null
    ? "sem base para comparar"
    : `${value > 0 ? "+" : ""}${value}% sobre o período anterior`;
}

function DashboardPage() {
  const pro = usePro();
  const today = todayISO();
  const [period, setPeriod] = useState<PeriodId>("mes");
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalText, setGoalText] = useState("");
  const ledger = ledgerDb.use();
  const appointments = appointmentsDb.use();
  const clients = clientsDb.use();
  const sessions = sessionsDb.use();
  const stock = stockDb.use();
  const bills = billsDb.use();
  const hours = hoursDb.use();
  const blocks = blocksDb.use();
  const settings = settingsDb.use();
  const goal = settings.goal && settings.goal > 0 ? settings.goal : 6000;

  const range = useMemo(() => periodRange(period, today), [period, today]);
  const before = useMemo(() => previousRange(range), [range]);

  const income = sumLedger(ledger, "entradas", range);
  const incomeBefore = sumLedger(ledger, "entradas", before);
  const done = doneAppointments(appointments, range);
  const doneBefore = doneAppointments(appointments, before);
  const ticket = average(income, done.length);
  const fresh = newClients(clients, range);
  const agenda = occupancy(appointments, hours, blocks, {
    from: range.from,
    to: period === "anterior" ? range.to : addDays(today, 0),
  });
  const weeks = weeklyIncome(ledger, range);
  const weekMax = Math.max(1, ...weeks.map((week) => week.value));
  const top = topProcedures(sessions, range);
  const topMax = Math.max(1, ...top.map((item) => item.count));

  const lowStock = stock.filter((item) => item.quantity <= item.min).length;
  const expiring = stock.filter((item) => {
    const days = daysToExpire(item);
    return days !== null && days <= 30;
  }).length;
  const dueBills = bills.filter((bill) => !bill.paid && bill.due <= addDays(today, 7));
  const receivable = ledger
    .filter((entry) => entry.kind === "receber")
    .reduce((total, entry) => total + entry.value, 0);
  const unconfirmed = appointments.filter(
    (item) =>
      item.status === "pending" &&
      !item.done &&
      !item.request &&
      item.date >= today &&
      item.date <= addDays(today, 7),
  ).length;
  const cold = clients.filter((client) => client.alert === "Sem atendimento recente").length;

  const attention: { icon: string; text: string; value: string; to: string; search?: object }[] = [
    {
      icon: "PackageMinus",
      text: "Estoque baixo ou vencendo",
      value: String(lowStock + expiring),
      to: "/estoque",
    },
    {
      icon: "Receipt",
      text: "Contas a pagar nos próximos 7 dias",
      value: dueBills.length
        ? `${dueBills.length} · ${brl(dueBills.reduce((t, b) => t + b.value, 0))}`
        : "0",
      to: "/financeiro",
      search: { aba: "contas" },
    },
    {
      icon: "Hourglass",
      text: "A receber das clientes",
      value: brl(receivable),
      to: "/financeiro",
      search: { aba: "receber" },
    },
    {
      icon: "CalendarClock",
      text: "Horários da semana sem confirmação",
      value: String(unconfirmed),
      to: "/agenda",
    },
    {
      icon: "Sparkles",
      text: "Clientes no período de retorno",
      value: String(cold),
      to: "/clientes",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <TopBar title="Dashboard" context={monthName(today)} user={pro} />

      <SegmentedTabs<PeriodId>
        size="sm"
        active={period}
        onSelect={setPeriod}
        tabs={PERIODS}
        className="max-w-md"
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <MetricCard
          label="Faturamento"
          value={brl(income)}
          hint={trend(income, incomeBefore)}
          icon="Wallet"
          tone="tech"
          compact
        />
        <MetricCard
          label="Atendimentos"
          value={done.length}
          hint={`${doneBefore.length} no período anterior`}
          icon="CheckCheck"
        />
        <MetricCard
          label="Ticket médio"
          value={brl(ticket)}
          hint="por atendimento"
          icon="Receipt"
          compact
        />
        <MetricCard
          label="Novas clientes"
          value={fresh.length}
          hint={`${clients.length} na carteira`}
          icon="UserPlus"
        />
        <MetricCard
          label="Retorno"
          value={`${returnShare(done)}%`}
          hint="dos atendimentos"
          icon="RotateCcw"
        />
        <MetricCard
          label="Ocupação"
          value={`${agenda.pct}%`}
          hint="da agenda aberta"
          icon="CalendarDays"
        />
      </div>

      {period === "mes" ? (
        <section className={card}>
          <div className="flex items-center gap-3">
            <span className={`${heading} flex-1`}>Meta do mês</span>
            <button
              type="button"
              className="min-h-9 text-[12.5px] text-[var(--teal)]"
              onClick={() => {
                setGoalText(String(goal));
                setGoalOpen(true);
              }}
            >
              Alterar meta
            </button>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[24px] font-medium">{brl(income)}</span>
            <span className="text-[13px] text-muted-foreground">de {brl(goal)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--eb-ivory-a10)]" aria-hidden>
            <div
              className="h-full rounded-full bg-[var(--eb-teal-500)] transition-[width]"
              style={{ width: `${Math.min(100, Math.round((income / goal) * 100))}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {income >= goal
              ? "Meta batida."
              : `Faltam ${brl(goal - income)} (${Math.min(100, Math.round((income / goal) * 100))}% da meta).`}
          </span>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className={card}>
          <span className={heading}>Faturamento por semana</span>
          {income > 0 ? (
            <div
              className="flex h-44 items-end gap-2"
              role="img"
              aria-label="Faturamento por semana"
            >
              {weeks.map((week) => (
                <div
                  key={week.from}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                >
                  <span className="font-mono text-[10.5px] text-muted-foreground">
                    {week.value ? brl(week.value).replace("R$ ", "") : ""}
                  </span>
                  <div
                    className="w-full max-w-12 rounded-t-md bg-[var(--eb-teal-500)]"
                    style={{
                      height: `${Math.max(4, (week.value / weekMax) * 100)}%`,
                      opacity: week.value ? 1 : 0.25,
                    }}
                  />
                  <span className="font-mono text-[10.5px] text-muted-foreground">
                    {`${week.from.slice(8, 10)}/${week.from.slice(5, 7)}`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">Sem entradas neste período.</p>
          )}
        </section>

        <section className={card}>
          <span className={heading}>Procedimentos mais feitos</span>
          {top.length ? (
            <div className="flex flex-col gap-3">
              {top.map((item) => (
                <div key={item.name} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 break-words text-[13.5px]">{item.name}</span>
                    <span className="flex-none font-mono text-xs text-muted-foreground">
                      {item.count}× · {brl(item.revenue)}
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-[var(--eb-ivory-a10)]"
                    aria-hidden
                  >
                    <div
                      className="h-full rounded-full bg-[var(--eb-nude-500)]"
                      style={{ width: `${(item.count / topMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              Os procedimentos aparecem aqui quando você finalizar atendimentos.
            </p>
          )}
        </section>
      </div>

      <section className={card}>
        <span className={heading}>Precisa de atenção</span>
        <div className="flex flex-col">
          {attention.map((item) => (
            <Link
              key={item.text}
              to={item.to}
              {...(item.search ? { search: item.search as never } : {})}
              className="flex min-h-12 items-center gap-3 border-b border-[var(--border-hairline)] py-2 last:border-b-0"
            >
              <Icon name={item.icon} size={17} color="var(--eb-nude-300)" />
              <span className="min-w-0 flex-1 text-[13.5px]">{item.text}</span>
              <span className="flex-none font-mono text-[13px]">{item.value}</span>
              <Icon name="ChevronRight" size={16} color="var(--text-secondary)" />
            </Link>
          ))}
        </div>
      </section>

      <Drawer
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        title="Meta do mês"
        subtitle="Quanto você quer faturar por mês"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setGoalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="tech"
              className="flex-1"
              onClick={() => {
                const value = Number(goalText.replace(/\./g, "").replace(",", "."));
                if (value > 0) {
                  settingsDb.set((current) => ({ ...current, goal: Math.round(value) }));
                  setGoalOpen(false);
                }
              }}
            >
              <Icon name="Check" size={18} /> Salvar meta
            </Button>
          </>
        }
      >
        <Input
          label="Meta de faturamento"
          trailing="R$"
          inputMode="decimal"
          value={goalText}
          onChange={(event) => setGoalText(event.target.value)}
        />
      </Drawer>
    </div>
  );
}
