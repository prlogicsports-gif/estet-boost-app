import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { AlertCard } from "@/components/eb/alert-card";
import { EmptyState } from "@/components/eb/empty-state";
import { Icon, WhatsAppIcon } from "@/components/eb/icon";
import { IconButton } from "@/components/eb/icon-button";
import { Input } from "@/components/eb/input";
import { Drawer, Modal } from "@/components/eb/overlays";
import { StatusBadge } from "@/components/eb/status-badge";
import { ToastHost } from "@/components/eb/toast";
import { Button } from "@/components/ui/button";
import { appointmentsDb, clientsDb } from "@/data/db";
import { formatWeekday, todayISO } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import { brl } from "@/lib/view";
import { confirmationText, openWhatsApp } from "@/lib/whatsapp";
import {
  approveCancel,
  approveRequest,
  approveReschedule,
  cancelAppointment,
  confirmAppointment,
  declineRequest,
  declineReschedule,
  rescheduleAppointment,
} from "@/services/appointments.service";

export const Route = createFileRoute("/_gestor/atendimentos/$appointmentId")({
  head: () => ({ meta: [{ title: "Atendimento — EstetBoost." }] }),
  component: AtendimentoPage,
});

function AtendimentoPage() {
  const session = useSession();
  const { appointmentId } = Route.useParams();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [moving, setMoving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const appointment = appointmentsDb.use().find((item) => item.id === appointmentId);
  const client = clientsDb.use().find((item) => item.id === appointment?.clientId);
  const [newDate, setNewDate] = useState(todayISO());
  const [newTime, setNewTime] = useState("14:00");

  useEffect(() => {
    if (appointment) {
      setNewDate(appointment.date);
      setNewTime(appointment.time);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moving]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!appointment) {
    return (
      <EmptyState
        icon="CalendarClock"
        title="Atendimento não encontrado"
        description="Ele pode ter sido remarcado ou cancelado."
        action={
          <Button asChild>
            <Link to="/hoje">Voltar para hoje</Link>
          </Button>
        }
      />
    );
  }

  const first = appointment.kind === "primeira";
  const cancelled = appointment.status === "cancelled";
  const when =
    appointment.date === todayISO()
      ? `hoje às ${appointment.time}`
      : `${formatWeekday(appointment.date)} às ${appointment.time}`;
  const facts: [string, string][] = [
    ["Objetivo da cliente", client?.goal ?? "Ainda não registrado"],
    [
      "Último atendimento",
      client?.lastVisit && client.lastVisit !== "—" ? client.lastVisit : "Nenhum ainda",
    ],
    ["Alergias", client?.allergies ?? "Nenhuma registrada"],
    ["Contraindicações", client?.contra ?? "Nenhuma registrada"],
    ["Sensibilidades anteriores", client?.note ?? "Nenhuma registrada"],
    ["Informações faltantes", first ? "Anamnese não iniciada" : "Rotina de casa não atualizada"],
    ...(can(session, "financeiro")
      ? [
          ["Valor combinado", `${brl(appointment.price)} · ${appointment.payment}`] as [
            string,
            string,
          ],
        ]
      : []),
    ["Duração", `${appointment.duration} min`],
  ];
  const start = () =>
    navigate({ to: "/atendimento/$sessionId", params: { sessionId: appointment.id } });
  const say = (message: string) => setToast(message);

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex items-center gap-2.5">
        <IconButton icon="ArrowLeft" label="Voltar" onClick={() => navigate({ to: "/hoje" })} />
        <span className="text-[13px] text-muted-foreground">Atendimento</span>
      </div>

      <header className="flex flex-wrap items-center gap-3.5">
        <span className="grid size-14 place-items-center rounded-full bg-[var(--eb-nude-a32)] text-lg font-medium">
          {appointment.initials}
        </span>
        <div className="min-w-40 flex-1">
          <h1 className="text-[26px] font-medium leading-[1.2] tracking-[-0.015em]">
            {appointment.client}
          </h1>
          <p className="text-[13.5px] text-[var(--text-secondary)]">
            {appointment.procedure} · {when}
          </p>
        </div>
        <StatusBadge
          tone={appointment.status}
          {...(appointment.done ? { icon: "CheckCheck" } : {})}
        >
          {appointment.done ? "Concluído" : undefined}
        </StatusBadge>
      </header>

      <div className="flex flex-wrap gap-2">
        <StatusBadge tone="info" icon={first ? "Sparkles" : "RotateCcw"}>
          {first ? "Primeira consulta" : "Retorno"}
        </StatusBadge>
        {appointment.session && appointment.sessionsTotal ? (
          <StatusBadge tone="info" icon="Layers">
            Sessão {appointment.session} de {appointment.sessionsTotal} · restam{" "}
            {appointment.sessionsTotal - appointment.session}
          </StatusBadge>
        ) : null}
        <StatusBadge tone="info" icon="Wallet">
          {brl(appointment.price)}
        </StatusBadge>
      </div>

      {appointment.request ? (
        <AlertCard
          tone="tech"
          icon="CalendarPlus"
          title="Solicitação da cliente"
          description="Ela pediu este horário. Aprove ou recuse."
        />
      ) : null}
      {appointment.reschedule && appointment.proposedDate ? (
        <AlertCard
          tone="tech"
          icon="CalendarClock"
          title="Pedido de remarcação"
          description={`Ela propõe ${formatWeekday(appointment.proposedDate)} · ${appointment.proposedTime ?? ""}`}
        />
      ) : null}
      {appointment.cancelRequest ? (
        <AlertCard
          tone="warn"
          icon="AlertTriangle"
          title="Pedido de cancelamento"
          description="Faltam menos de 24 horas. A decisão é sua."
        />
      ) : null}

      <section
        className="rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-card)] px-[18px] py-4"
        style={{ boxShadow: "var(--shadow-raised)" }}
      >
        <h2 className="mb-3 text-xl font-medium tracking-[-0.01em]">O que você precisa saber</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-6 gap-y-0.5">
          {facts.map(([key, value]) => (
            <div key={key} className="border-b border-[var(--border-hairline)] py-[9px]">
              <div className="text-[11.5px] text-muted-foreground">{key}</div>
              <div className="mt-0.5 text-[13.5px]">{value}</div>
            </div>
          ))}
        </div>
        {appointment.notes ? (
          <p className="mt-3 text-[13px] text-[var(--text-secondary)]">
            Observação: {appointment.notes}
          </p>
        ) : null}
      </section>

      {first ? (
        <AlertCard
          tone="warn"
          icon="ClipboardList"
          title="Esta cliente ainda não possui anamnese."
          description="Criar agora leva cerca de 4 minutos."
          actionLabel="Criar anamnese"
          onAction={() =>
            navigate({ to: "/clientes/$clientId", params: { clientId: appointment.clientId } })
          }
        />
      ) : (
        <AlertCard
          tone="info"
          icon="History"
          title="Compare a evolução antes de começar."
          description="Fotos e mapa facial da última sessão."
          actionLabel="Ver evolução"
          onAction={() =>
            navigate({ to: "/clientes/$clientId", params: { clientId: appointment.clientId } })
          }
        />
      )}

      <div className="flex flex-wrap gap-2.5">
        {appointment.request ? (
          <>
            <Button
              type="button"
              variant="tech"
              onClick={() => {
                approveRequest(appointment.id);
                say("Solicitação aprovada");
              }}
            >
              <Icon name="Check" size={18} /> Aprovar horário
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                declineRequest(appointment.id);
                say("Solicitação recusada");
              }}
            >
              Recusar
            </Button>
          </>
        ) : appointment.reschedule ? (
          <>
            <Button
              type="button"
              variant="tech"
              onClick={() => (approveReschedule(appointment.id), say("Remarcação aprovada"))}
            >
              <Icon name="Check" size={18} /> Aprovar remarcação
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => (declineReschedule(appointment.id), say("Remarcação recusada"))}
            >
              Recusar
            </Button>
          </>
        ) : appointment.cancelRequest ? (
          <>
            <Button
              type="button"
              variant="danger"
              onClick={() => (approveCancel(appointment.id), say("Cancelamento aprovado"))}
            >
              Aprovar cancelamento
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => (
                appointmentsDb.set((list) =>
                  list.map((x) => (x.id === appointment.id ? { ...x, cancelRequest: false } : x)),
                ),
                say("Horário mantido")
              )}
            >
              Manter horário
            </Button>
          </>
        ) : null}
        {!cancelled && !appointment.done ? (
          <>
            <Button type="button" variant="tech" onClick={start}>
              <Icon name="Play" size={18} /> Iniciar atendimento
            </Button>
            {appointment.status === "pending" && !appointment.request ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => (
                  confirmAppointment(appointment.id, "gestor"),
                  say("Horário confirmado")
                )}
              >
                <Icon name="Check" size={18} /> Confirmar horário
              </Button>
            ) : null}
          </>
        ) : null}
        {!cancelled && !appointment.done && client?.phone ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => openWhatsApp(client.phone, confirmationText(appointment))}
          >
            <WhatsAppIcon size={18} /> Confirmar pelo WhatsApp
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            navigate({ to: "/clientes/$clientId", params: { clientId: appointment.clientId } })
          }
        >
          <Icon name="FileText" size={18} /> Abrir prontuário
        </Button>
        {!cancelled && !appointment.done ? (
          <>
            <Button type="button" variant="ghost" onClick={() => setMoving(true)}>
              <Icon name="CalendarClock" size={18} /> Remarcar
            </Button>
            <Button type="button" variant="danger" onClick={() => setConfirm(true)}>
              <Icon name="X" size={18} /> Cancelar
            </Button>
          </>
        ) : null}
      </div>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        tone="danger"
        title="Cancelar este atendimento?"
        subtitle={`${appointment.client} será avisada por mensagem. A sessão volta para o pacote.`}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setConfirm(false)}>
              Voltar
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                cancelAppointment(appointment.id, "gestor");
                setConfirm(false);
                say("Atendimento cancelado");
              }}
            >
              Cancelar atendimento
            </Button>
          </>
        }
      />

      <Drawer
        open={moving}
        onClose={() => setMoving(false)}
        title="Remarcar atendimento"
        subtitle={`${appointment.client} · ${appointment.procedure}`}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setMoving(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="tech"
              className="flex-1"
              disabled={!newDate || !newTime}
              onClick={() => {
                rescheduleAppointment(appointment.id, newDate, newTime);
                setMoving(false);
                say("Horário alterado e cliente avisada");
              }}
            >
              <Icon name="Check" size={18} /> Confirmar novo horário
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-2.5">
          <Input
            label="Data"
            type="date"
            value={newDate}
            onChange={(event) => setNewDate(event.target.value)}
          />
          <Input
            label="Horário"
            type="time"
            value={newTime}
            onChange={(event) => setNewTime(event.target.value)}
          />
        </div>
      </Drawer>

      <ToastHost toast={toast ? { message: toast } : null} />
    </div>
  );
}
