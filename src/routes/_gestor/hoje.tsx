import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AlertCard } from "@/components/eb/alert-card";
import { AppointmentCard } from "@/components/eb/appointment-card";
import { Icon } from "@/components/eb/icon";
import { MetricCard } from "@/components/eb/metric-card";
import { TopBar } from "@/components/eb/top-bar";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { appointmentsDb, billsDb, clientsDb, stockDb } from "@/data/db";
import { usePro } from "@/lib/use-pro";
import { daysBetween, formatLong, nowHM, todayISO } from "@/lib/dates";
import { brl, byDateTime, toCard } from "@/lib/view";
import { notify } from "@/services/notify";
import { useClinicAppointments, useClinicClients } from "@/lib/use-clinic";

export const Route = createFileRoute("/_gestor/hoje")({
  head: () => ({
    meta: [
      { title: "Hoje — EstetBoost." },
      {
        name: "description",
        content: "Veja os atendimentos do dia e o que precisa da sua atenção agora.",
      },
      { property: "og:title", content: "Hoje — EstetBoost." },
      {
        property: "og:description",
        content: "Veja os atendimentos do dia e o que precisa da sua atenção agora.",
      },
    ],
  }),
  component: HojePage,
});

const sectionLabel =
  "text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground";

function HojePage() {
  const pro = usePro();
  const navigate = useNavigate();
  const { openNotifications, unread } = useShell();
  const today = todayISO();
  const all = useClinicAppointments();
  const clients = useClinicClients();
  const stock = stockDb.use();
  const bills = billsDb.use();

  const day = all
    .filter((item) => item.date === today && item.status !== "cancelled")
    .sort(byDateTime);
  const open = day.filter((item) => !item.done);
  const next = open.find((item) => item.time >= nowHM()) ?? open[0];
  const confirmed = day.filter((item) => item.status === "confirmed").length;
  const waiting = day.length - confirmed;
  const expected = day.reduce((total, item) => total + item.price, 0);
  const requests = all.filter((item) => item.request && item.status === "pending");
  const unconfirmed = open.filter((item) => item.status === "pending" && !item.request);
  const lowStock = stock.filter((item) => item.quantity <= item.min);
  const nextBill = bills.filter((bill) => !bill.paid).sort((a, b) => a.due.localeCompare(b.due))[0];
  const cold = clients.find((client) => client.alert === "Sem atendimento recente");

  const openAppointment = (id: string) =>
    navigate({ to: "/atendimentos/$appointmentId", params: { appointmentId: id } });
  const remind = () => {
    for (const item of unconfirmed) {
      notify({
        audience: "cliente",
        clientId: item.clientId,
        kind: "reminder",
        title: "Confirme seu atendimento de hoje",
        body: `${item.procedure} · às ${item.time}`,
        href: "/cliente/agenda",
      });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <TopBar
        title={`Bom dia, ${pro.name.split(" ")[0]}`}
        context={formatLong(today)}
        notifications={unread}
        user={pro}
        onNotifications={openNotifications}
        actions={
          <Button size="sm" onClick={() => navigate({ to: "/atendimento/novo" })}>
            <Icon name="Plus" size={15} /> Novo atendimento
          </Button>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
        <MetricCard label="Atendimentos" value={day.length} hint="hoje" icon="CalendarDays" />
        <MetricCard label="Confirmados" value={confirmed} icon="CheckCheck" tone="tech" />
        <MetricCard
          label="Aguardando"
          value={waiting}
          icon="Clock"
          tone="warn"
          hint="enviar lembrete"
        />
        <MetricCard
          label="Previsto"
          value={brl(expected)}
          icon="Wallet"
          tone="tech"
          hint={`${day.length} atendimentos`}
        />
      </div>

      {next ? (
        <section className="flex flex-col gap-2.5">
          <span className={sectionLabel}>Próximo atendimento</span>
          <AppointmentCard
            variant="hero"
            {...toCard(next)}
            onOpen={() => openAppointment(next.id)}
          />
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <span className={sectionLabel}>Atendimentos de hoje</span>
        {day.length ? (
          day.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openAppointment(item.id)}
              className="cursor-pointer text-left"
            >
              <AppointmentCard {...toCard(item)} />
            </button>
          ))
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-card)] bg-[var(--eb-ivory-a06)] px-4 py-6 text-center text-[13.5px] text-[var(--text-secondary)]">
            Nenhum atendimento hoje. Toque em "Novo atendimento" ou agende um horário.
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <span className={sectionLabel}>Precisa da sua atenção</span>
        {requests.length ? (
          <AlertCard
            tone="tech"
            icon="CalendarPlus"
            title={`${requests.length} ${requests.length === 1 ? "solicitação de horário" : "solicitações de horário"}`}
            description={requests.map((item) => item.client.split(" ")[0]).join(", ")}
            actionLabel="Revisar"
            onAction={() => navigate({ to: "/agenda" })}
          />
        ) : null}
        {unconfirmed.length ? (
          <AlertCard
            tone="warn"
            icon="Clock"
            title={`${unconfirmed.length} ${unconfirmed.length === 1 ? "cliente sem confirmação" : "clientes sem confirmação"}`}
            description={unconfirmed
              .map((item) => `${item.client.split(" ")[0]} às ${item.time}`)
              .join(" e ")}
            actionLabel="Enviar lembrete"
            onAction={remind}
          />
        ) : null}
        {lowStock[0] ? (
          <AlertCard
            tone="warn"
            icon="PackageMinus"
            title={`${lowStock[0].name} acabando`}
            description={`${lowStock[0].quantity} ${lowStock[0].unit} · mínimo ${lowStock[0].min}`}
            actionLabel="Ver estoque"
            onAction={() => navigate({ to: "/gestao" })}
          />
        ) : null}
        {nextBill ? (
          <AlertCard
            tone={daysBetween(today, nextBill.due) <= 3 ? "danger" : "info"}
            icon="Receipt"
            title={
              daysBetween(today, nextBill.due) < 0
                ? `${nextBill.name} está atrasada`
                : daysBetween(today, nextBill.due) === 0
                  ? `${nextBill.name} vence hoje`
                  : `${nextBill.name} vence em ${daysBetween(today, nextBill.due)} ${daysBetween(today, nextBill.due) === 1 ? "dia" : "dias"}`
            }
            description={brl(nextBill.value)}
            actionLabel="Ver contas"
            onAction={() => navigate({ to: "/gestao" })}
          />
        ) : null}
        {cold ? (
          <AlertCard
            tone="info"
            icon="Sparkles"
            title={`${cold.name} está no período de retorno`}
            description={`${cold.lastVisit} sem atendimento`}
            actionLabel="Ver cliente"
            onAction={() => navigate({ to: "/clientes/$clientId", params: { clientId: cold.id } })}
          />
        ) : null}
      </section>
    </div>
  );
}
