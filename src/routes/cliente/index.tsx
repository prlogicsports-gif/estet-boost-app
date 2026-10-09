import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AlertCard } from "@/components/eb/alert-card";
import { Icon } from "@/components/eb/icon";
import { Input } from "@/components/eb/input";
import { MetricCard } from "@/components/eb/metric-card";
import { BottomSheet } from "@/components/eb/overlays";
import { StatusBadge } from "@/components/eb/status-badge";
import { ToastHost } from "@/components/eb/toast";
import { TopBar } from "@/components/eb/top-bar";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { appointmentsDb, careDb, ledgerDb } from "@/data/db";
import { Select } from "@/components/eb/select";
import { useClinic } from "@/lib/use-clinic";
import { addDays, formatLong, formatShort, todayISO } from "@/lib/dates";
import { useClient } from "@/lib/use-client";
import { brl, byDateTime } from "@/lib/view";
import { confirmAppointment, requestReschedule } from "@/services/appointments.service";
import { reportPayment } from "@/services/finance.service";

export const Route = createFileRoute("/cliente/")({
  head: () => ({
    meta: [
      { title: "Sua área — EstetBoost." },
      {
        name: "description",
        content: "Acompanhe seus horários, sua evolução e as recomendações da sua esteticista.",
      },
      { property: "og:title", content: "Sua área — EstetBoost." },
      {
        property: "og:description",
        content: "Acompanhe seus horários, sua evolução e as recomendações da sua esteticista.",
      },
    ],
  }),
  component: InicioPage,
});

function InicioPage() {
  const navigate = useNavigate();
  const { openNotifications, unread } = useShell();
  const { clientId, client, profile } = useClient();
  const { clinic } = useClinic();
  const proName = clinic?.name ?? "sua clínica";
  const today = todayISO();
  const mine = appointmentsDb.use().filter((item) => item.clientId === clientId);
  const care = careDb
    .use()
    .filter((item) => item.clientId === clientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const upcoming = mine
    .filter((item) => !item.done && item.status !== "cancelled" && item.date >= today)
    .sort(byDateTime);
  const next = upcoming[0];
  const last = mine
    .filter((item) => item.done)
    .sort(byDateTime)
    .at(-1);

  const dues = ledgerDb
    .use()
    .filter((entry) => entry.kind === "receber" && entry.clientId === clientId)
    .sort((a, b) => (a.due ?? a.date).localeCompare(b.due ?? b.date));
  const [paying, setPaying] = useState<string | null>(null);
  const [method, setMethod] = useState("Pix");
  const paid = dues.find((entry) => entry.id === paying);
  const [moving, setMoving] = useState(false);
  const [date, setDate] = useState(addDays(today, 1));
  const [time, setTime] = useState("14:00");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="flex flex-col gap-[18px]">
      <TopBar
        title={`Olá, ${profile.first}`}
        context="Seu cuidado, organizado."
        notifications={unread}
        user={profile}
        onNotifications={openNotifications}
      />

      <section
        className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-card)] p-[18px]"
        style={{ boxShadow: "var(--shadow-raised)" }}
      >
        <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
          Próximo atendimento
        </span>
        {next ? (
          <>
            <div className="flex flex-wrap items-center gap-3.5">
              <div className="min-w-[180px] flex-1">
                <div className="text-xl font-medium tracking-[-0.01em]">{next.procedure}</div>
                <div className="mt-[3px] text-[13.5px] text-[var(--text-secondary)]">
                  {formatLong(next.date).split(" de ").slice(0, 2).join(" de ")} · {next.time} · com{" "}
                  {proName}
                </div>
              </div>
              <StatusBadge tone={next.status} />
            </div>
            <div className="flex flex-wrap gap-2">
              {next.session ? (
                <StatusBadge tone="info" icon="Layers">
                  Sessão {next.session}
                  {next.sessionsTotal ? ` de ${next.sessionsTotal}` : ""}
                </StatusBadge>
              ) : null}
              <StatusBadge tone="info" icon="MapPin">
                {proName}
              </StatusBadge>
              {next.reschedule ? (
                <StatusBadge tone="pending" icon="CalendarClock">
                  Remarcação aguardando
                </StatusBadge>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2.5">
              {next.status === "pending" ? (
                <Button
                  type="button"
                  variant="tech"
                  onClick={() => {
                    confirmAppointment(next.id, "cliente");
                    setToast("Presença confirmada");
                  }}
                >
                  <Icon name="Check" size={18} /> Confirmar presença
                </Button>
              ) : (
                <Button type="button" variant="secondary" disabled>
                  <Icon name="Check" size={18} /> Presença confirmada
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                onClick={() => (setDate(next.date), setTime(next.time), setMoving(true))}
              >
                <Icon name="CalendarClock" size={18} /> Pedir remarcação
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="text-[15px] text-[var(--text-secondary)]">
              Você ainda não tem horário marcado.
            </div>
            <Button
              type="button"
              variant="tech"
              className="self-start"
              onClick={() => navigate({ to: "/cliente/agenda" })}
            >
              <Icon name="CalendarPlus" size={18} /> Solicitar um horário
            </Button>
          </>
        )}
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <MetricCard
          label="Sessões restantes"
          value={next?.session && next.sessionsTotal ? next.sessionsTotal - next.session + 1 : "—"}
          hint={next?.sessionsTotal ? `de ${next.sessionsTotal} no pacote` : "sem pacote ativo"}
          icon="Layers"
          tone="tech"
        />
        <MetricCard
          label="Último atendimento"
          value={
            last
              ? formatShort(last.date)
              : client?.lastVisit && client.lastVisit !== "—"
                ? client.lastVisit
                : "—"
          }
          icon="History"
        />
        <MetricCard
          label="Retorno sugerido"
          value={next ? formatShort(next.date) : "—"}
          icon="Sparkles"
          tone="tech"
        />
      </div>

      {dues.length ? (
        <section className="flex flex-col gap-2.5">
          <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
            Pagamentos
          </span>
          {dues.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-3"
            >
              <div className="min-w-[150px] flex-1">
                <div className="text-sm font-medium">{entry.origin}</div>
                <div className="font-mono text-[11.5px] text-muted-foreground">
                  Vence {formatShort(entry.due ?? entry.date)}
                </div>
              </div>
              <span className="font-mono text-sm font-medium">{brl(entry.value)}</span>
              {entry.reported ? (
                <StatusBadge tone="pending" icon="Hourglass" size="sm">
                  Aguardando confirmação
                </StatusBadge>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => (setMethod(entry.method || "Pix"), setPaying(entry.id))}
                >
                  <Icon name="Wallet" size={15} /> Já paguei
                </Button>
              )}
            </div>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-2.5">
        <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
          Recomendações recentes
        </span>
        {care.length ? (
          care
            .slice(0, 3)
            .map((item) => (
              <AlertCard
                key={item.id}
                tone="info"
                icon={
                  /manh|protetor/i.test(item.text)
                    ? "Sun"
                    : /noite/i.test(item.text)
                      ? "Moon"
                      : "Droplets"
                }
                title={item.text.split(/[.!?]/)[0] ?? item.text}
                {...(item.text.includes(".")
                  ? { description: item.text.split(".").slice(1).join(".").trim() }
                  : {})}
              />
            ))
        ) : (
          <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-card)] px-4 py-5 text-[13px] text-muted-foreground">
            As recomendações da {proName} aparecem aqui depois de cada atendimento.
          </p>
        )}
      </section>

      <Button type="button" className="w-full" onClick={() => navigate({ to: "/cliente/agenda" })}>
        <Icon name="CalendarPlus" size={18} /> Solicitar novo horário
      </Button>

      <BottomSheet
        open={Boolean(paid)}
        onClose={() => setPaying(null)}
        title="Informar pagamento"
        subtitle={paid ? `${paid.origin} · ${brl(paid.value)}. ${proName} confere e confirma.` : ""}
        footer={
          <Button
            type="button"
            variant="tech"
            className="w-full"
            onClick={() => {
              if (paid) reportPayment(paid.id, method);
              setPaying(null);
              setToast("Pagamento informado");
            }}
          >
            <Icon name="Check" size={18} /> Informar que paguei
          </Button>
        }
      >
        <Select
          label="Como você pagou?"
          options={["Pix", "Cartão de crédito", "Cartão de débito", "Dinheiro", "Transferência"]}
          value={method}
          onChange={(event) => setMethod(event.target.value)}
        />
      </BottomSheet>

      <BottomSheet
        open={moving}
        onClose={() => setMoving(false)}
        title="Pedir remarcação"
        subtitle={`${proName} confirma e avisa você`}
        footer={
          <Button
            type="button"
            variant="tech"
            className="w-full"
            disabled={!date || !time || !next}
            onClick={() => {
              if (next) requestReschedule(next.id, date, time);
              setMoving(false);
              setToast("Pedido enviado");
            }}
          >
            <Icon name="Check" size={18} /> Enviar pedido
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-2.5">
          <Input
            label="Novo dia"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <Input
            label="Novo horário"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </div>
      </BottomSheet>

      <ToastHost
        toast={toast ? { message: toast, detail: `${proName} responde em até 24 horas.` } : null}
      />
    </div>
  );
}
