import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Calendar } from "@/components/eb/calendar";
import { EmptyState } from "@/components/eb/empty-state";
import { Icon } from "@/components/eb/icon";
import { Input } from "@/components/eb/input";
import { BottomSheet, Modal } from "@/components/eb/overlays";
import { StatusBadge } from "@/components/eb/status-badge";
import { ToastHost } from "@/components/eb/toast";
import { TopBar } from "@/components/eb/top-bar";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { blocksDb, hoursDb, proceduresDb } from "@/data/db";
import { proName } from "@/data/cliente-mock";
import { addDays, formatShort, formatWeekday, todayISO } from "@/lib/dates";
import { slotsFor } from "@/lib/availability";
import { useClient } from "@/lib/use-client";
import { useClinicAppointments } from "@/lib/use-clinic";
import type { AppointmentRec } from "@/lib/models";
import { byDateTime } from "@/lib/view";
import {
  cancelAppointment,
  confirmAppointment,
  requestAppointment,
  requestReschedule,
} from "@/services/appointments.service";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cliente/agenda")({
  head: () => ({ meta: [{ title: "Agenda — EstetBoost." }] }),
  component: AgendaClientePage,
});

const STEPS = ["Escolher serviço", "Escolher data", "Escolher horário", "Confirmar solicitação"];

function AgendaClientePage() {
  const { openNotifications, unread } = useShell();
  const { clientId, profile } = useClient();
  const all = useClinicAppointments();
  const hours = hoursDb.use();
  const blocks = blocksDb.use();
  const SERVICES = proceduresDb.use().map((item) => item.name);
  const today = todayISO();
  const mine = all
    .filter(
      (item) =>
        item.clientId === clientId &&
        !item.done &&
        item.status !== "cancelled" &&
        item.date >= today,
    )
    .sort(byDateTime);

  const [mode, setMode] = useState<"novo" | "remarcar" | null>(null);
  const [target, setTarget] = useState<AppointmentRec | null>(null);
  const [step, setStep] = useState(0);
  const [service, setService] = useState("");
  const [date, setDate] = useState(addDays(today, 7));
  const [cursor, setCursor] = useState(() => ({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  }));
  const [time, setTime] = useState("14:00");
  const [notes, setNotes] = useState("");
  const [cancel, setCancel] = useState<AppointmentRec | null>(null);
  const [toast, setToast] = useState<{ message: string; detail: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const taken = useMemo(
    () =>
      new Set(
        all
          .filter((item) => item.date === date && item.status !== "cancelled" && !item.done)
          .map((item) => item.time),
      ),
    [all, date],
  );
  const past = date < today;
  const TIMES = slotsFor(date, hours, blocks);
  const chosenService = service || SERVICES[0] || "";

  const open = (next: "novo" | "remarcar", appointment: AppointmentRec | null = null) => {
    setMode(next);
    setTarget(appointment);
    setStep(next === "remarcar" ? 1 : 0);
    setDate(appointment?.date ?? addDays(today, 7));
    setTime(appointment?.time ?? "14:00");
    setNotes("");
    const base = new Date(`${appointment?.date ?? addDays(today, 7)}T12:00:00`);
    setCursor({ year: base.getFullYear(), month: base.getMonth() });
  };

  const send = () => {
    if (mode === "novo") {
      requestAppointment({ clientId, procedure: chosenService, date, time, notes });
      setToast({ message: "Solicitação enviada", detail: `${proName} responde em até 24 horas.` });
    } else if (target) {
      requestReschedule(target.id, date, time);
      setToast({
        message: "Pedido de remarcação enviado",
        detail: `${proName} confirma e avisa você.`,
      });
    }
    setMode(null);
  };

  const lastStep = mode === "remarcar" ? 2 : 3;
  const canGo =
    step === 1
      ? !past && slotsFor(date, hours, blocks).length > 0
      : step === 2
        ? TIMES.includes(time) && !taken.has(time)
        : true;
  const title = mode === "remarcar" ? "Pedir remarcação" : "Solicitar novo horário";
  const labels = mode === "remarcar" ? ["", "Escolher data", "Escolher horário"] : STEPS;
  const stepNumber = mode === "remarcar" ? step : step + 1;
  const stepTotal = mode === "remarcar" ? 2 : 4;

  return (
    <div className="flex flex-col gap-4">
      <TopBar
        title="Agenda"
        context="Seus horários com Fernanda"
        notifications={unread}
        user={profile}
        onNotifications={openNotifications}
        actions={
          <Button type="button" size="sm" onClick={() => open("novo")}>
            <Icon name="CalendarPlus" size={15} /> Solicitar
          </Button>
        }
      />

      <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
        Próximos horários
      </span>
      {mine.length ? (
        mine.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] p-3.5"
          >
            <div className="flex items-center gap-3">
              <span className="w-[58px] font-mono text-[var(--nude-sand)]">
                {formatShort(item.date)}
              </span>
              <span className="w-12 font-mono text-[var(--text-secondary)]">{item.time}</span>
              <span className="min-w-0 flex-1 text-[13.5px]">{item.procedure}</span>
              <StatusBadge tone={item.status} size="sm" />
            </div>
            {item.request ? (
              <p className="text-xs text-[var(--eb-amber-500)]">
                Solicitação enviada: aguardando {proName} aprovar.
              </p>
            ) : null}
            {item.reschedule && item.proposedDate ? (
              <p className="text-xs text-[var(--eb-amber-500)]">
                Remarcação pedida para {formatWeekday(item.proposedDate)} · {item.proposedTime}:
                aguardando.
              </p>
            ) : null}
            {item.cancelRequest ? (
              <p className="text-xs text-[var(--eb-amber-500)]">
                Cancelamento pedido: aguardando {proName}.
              </p>
            ) : null}
            {!item.request ? (
              <div className="flex flex-wrap gap-2">
                {item.status === "pending" ? (
                  <Button
                    type="button"
                    variant="tech"
                    size="sm"
                    onClick={() => (
                      confirmAppointment(item.id, "cliente"),
                      setToast({
                        message: "Presença confirmada",
                        detail: `${proName} foi avisada.`,
                      })
                    )}
                  >
                    <Icon name="Check" size={15} /> Confirmar presença
                  </Button>
                ) : null}
                {!item.reschedule ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => open("remarcar", item)}
                  >
                    <Icon name="CalendarClock" size={15} /> Pedir remarcação
                  </Button>
                ) : null}
                {!item.cancelRequest ? (
                  <Button type="button" variant="danger" size="sm" onClick={() => setCancel(item)}>
                    <Icon name="X" size={15} /> Cancelar horário
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))
      ) : (
        <EmptyState
          icon="CalendarPlus"
          title="Nenhum horário marcado"
          description="Peça um horário e a Fernanda confirma por aqui."
          compact
          action={
            <Button type="button" onClick={() => open("novo")}>
              Solicitar horário
            </Button>
          }
        />
      )}
      <p className="text-xs text-muted-foreground">
        Cancelamentos com menos de 24 horas de antecedência precisam de confirmação da profissional.
      </p>

      <BottomSheet
        open={mode !== null}
        onClose={() => setMode(null)}
        title={title}
        subtitle={`Etapa ${stepNumber} de ${stepTotal} · ${labels[step] ?? ""}`}
        footer={
          step < lastStep ? (
            <Button
              type="button"
              variant="tech"
              className="w-full"
              disabled={!canGo}
              onClick={() => setStep((current) => current + 1)}
            >
              Continuar
            </Button>
          ) : (
            <Button
              type="button"
              variant="tech"
              className="w-full"
              disabled={!canGo}
              onClick={send}
            >
              <Icon name="Check" size={18} />{" "}
              {mode === "remarcar" ? "Enviar pedido" : "Enviar solicitação"}
            </Button>
          )
        }
      >
        {step === 0 && mode === "novo" ? (
          <div className="flex flex-col gap-2">
            {SERVICES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setService(item)}
                className={cn(
                  "min-h-12 rounded-[var(--radius-md)] border px-3.5 text-left text-sm",
                  chosenService === item
                    ? "border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a12)]"
                    : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)]",
                )}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
        {step === 1 ? (
          <div className="flex flex-col gap-2">
            <Calendar
              view="month"
              year={cursor.year}
              month={cursor.month}
              selected={date}
              onSelectDate={(iso) => setDate(iso)}
              onNavigate={(delta) =>
                setCursor((current) => {
                  const next = new Date(current.year, current.month + delta, 1);
                  return { year: next.getFullYear(), month: next.getMonth() };
                })
              }
              events={{}}
            />
            {past ? (
              <p className="text-xs text-[var(--coral)]">Escolha uma data a partir de hoje.</p>
            ) : !TIMES.length ? (
              <p className="text-xs text-[var(--coral)]">
                A agenda não atende nesse dia. Escolha outra data.
              </p>
            ) : null}
          </div>
        ) : null}
        {step === 2 ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {TIMES.map((item) => (
                <button
                  key={item}
                  type="button"
                  disabled={taken.has(item)}
                  onClick={() => setTime(item)}
                  className={cn(
                    "min-h-11 rounded-full border px-[18px] font-mono text-sm disabled:opacity-35",
                    time === item
                      ? "border-transparent bg-[var(--eb-nude-500)] text-[var(--text-on-nude)]"
                      : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)]",
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Horários riscados já estão ocupados neste dia.
            </p>
          </div>
        ) : null}
        {step === 3 && mode === "novo" ? (
          <div className="flex flex-col gap-2.5">
            <div className="rounded-[var(--radius-md)] border border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] px-4 py-3.5 text-sm leading-[1.8]">
              <div>{chosenService}</div>
              <div className="text-[var(--text-secondary)]">
                {formatWeekday(date)} · {time}
              </div>
              <div className="text-[12.5px] text-muted-foreground">Com {proName}</div>
            </div>
            <Input
              label="Observação para a profissional"
              multiline
              rows={3}
              placeholder="Opcional"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A solicitação vai para Fernanda confirmar. Você recebe um aviso assim que ela
              responder.
            </p>
          </div>
        ) : null}
      </BottomSheet>

      <Modal
        open={cancel !== null}
        onClose={() => setCancel(null)}
        tone="danger"
        title="Cancelar seu horário?"
        subtitle={
          cancel &&
          (new Date(`${cancel.date}T${cancel.time}:00`).getTime() - Date.now()) / 3600000 < 24
            ? "Faltam menos de 24 horas: Fernanda precisa aprovar o cancelamento."
            : "Fernanda é avisada e a sessão volta para o pacote."
        }
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setCancel(null)}>
              Manter
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                if (cancel) cancelAppointment(cancel.id, "cliente");
                setCancel(null);
                setToast({ message: "Pedido enviado", detail: `${proName} foi avisada.` });
              }}
            >
              Cancelar horário
            </Button>
          </>
        }
      />

      <ToastHost toast={toast} />
    </div>
  );
}
