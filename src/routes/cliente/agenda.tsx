import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Calendar } from "@/components/eb/calendar";
import { Icon } from "@/components/eb/icon";
import { Input } from "@/components/eb/input";
import { BottomSheet, Modal } from "@/components/eb/overlays";
import { StatusBadge } from "@/components/eb/status-badge";
import { ToastHost } from "@/components/eb/toast";
import { TopBar } from "@/components/eb/top-bar";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { client, proName, upcoming } from "@/data/cliente-mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cliente/agenda")({
  head: () => ({ meta: [{ title: "Agenda — EstetBoost." }] }),
  component: AgendaClientePage,
});

const SERVICES = [
  "Limpeza de pele profunda",
  "Peeling suave",
  "Hidratação facial",
  "Drenagem facial",
];
const TIMES = ["09:00", "10:30", "14:00", "16:30", "18:00"];
const STEPS = ["Escolher serviço", "Escolher data", "Escolher horário", "Confirmar solicitação"];

function AgendaClientePage() {
  const { openNotifications, unread } = useShell();
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  const [service, setService] = useState(SERVICES[0] ?? "");
  const [date, setDate] = useState("2026-09-22");
  const [time, setTime] = useState("14:00");
  const [sent, setSent] = useState(false);
  const [cancel, setCancel] = useState(false);

  useEffect(() => {
    if (!sent) return;
    const timer = window.setTimeout(() => setSent(false), 2800);
    return () => window.clearTimeout(timer);
  }, [sent]);

  return (
    <div className="flex flex-col gap-4">
      <TopBar
        title="Agenda"
        context="Seus horários com Fernanda"
        notifications={unread}
        user={client}
        onNotifications={openNotifications}
        actions={
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setOpen(true);
              setStep(0);
            }}
          >
            <Icon name="CalendarPlus" size={15} /> Solicitar
          </Button>
        }
      />

      <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
        Próximos horários
      </span>
      {upcoming.map((item) => (
        <div
          key={`${item.date}-${item.time}`}
          className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] p-3.5"
        >
          <span className="w-[58px] font-mono text-[var(--nude-sand)]">{item.date}</span>
          <span className="w-12 font-mono text-[var(--text-secondary)]">{item.time}</span>
          <span className="flex-1 text-[13.5px]">{item.procedure}</span>
          <StatusBadge tone={item.status} size="sm" />
        </div>
      ))}
      <div className="flex flex-wrap gap-2.5">
        <Button type="button" variant="secondary" size="sm">
          <Icon name="Check" size={15} /> Confirmar presença
        </Button>
        <Button type="button" variant="secondary" size="sm">
          <Icon name="CalendarClock" size={15} /> Pedir remarcação
        </Button>
        <Button type="button" variant="danger" size="sm" onClick={() => setCancel(true)}>
          <Icon name="X" size={15} /> Cancelar horário
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Cancelamentos com menos de 24 horas de antecedência precisam de confirmação da profissional.
      </p>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Solicitar novo horário"
        subtitle={`Etapa ${step + 1} de 4 · ${STEPS[step]}`}
        footer={
          step < 3 ? (
            <Button
              type="button"
              variant="tech"
              className="w-full"
              onClick={() => setStep((current) => current + 1)}
            >
              Continuar
            </Button>
          ) : (
            <Button
              type="button"
              variant="tech"
              className="w-full"
              onClick={() => {
                setOpen(false);
                setSent(true);
              }}
            >
              <Icon name="Check" size={18} /> Enviar solicitação
            </Button>
          )
        }
      >
        {step === 0 ? (
          <div className="flex flex-col gap-2">
            {SERVICES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setService(item)}
                className={cn(
                  "min-h-12 rounded-[var(--radius-md)] border px-3.5 text-left text-sm",
                  service === item
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
          <Calendar
            view="month"
            year={2026}
            month={8}
            selected={date}
            onSelectDate={(iso) => setDate(iso)}
            events={{
              "2026-09-15": [{ time: "14:00", client: "Seu horário", status: "confirmed" }],
            }}
          />
        ) : null}
        {step === 2 ? (
          <div className="flex flex-wrap gap-2">
            {TIMES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTime(item)}
                className={cn(
                  "min-h-11 rounded-full border px-[18px] font-mono text-sm",
                  time === item
                    ? "border-transparent bg-[var(--eb-nude-500)] text-[var(--text-on-nude)]"
                    : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)]",
                )}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
        {step === 3 ? (
          <div className="flex flex-col gap-2.5">
            <div className="rounded-[var(--radius-md)] border border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] px-4 py-3.5 text-sm leading-[1.8]">
              <div>{service}</div>
              <div className="text-[var(--text-secondary)]">
                {new Date(`${date}T00:00`).toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}{" "}
                · {time}
              </div>
              <div className="text-[12.5px] text-muted-foreground">Com {proName}</div>
            </div>
            <Input
              label="Observação para a profissional"
              multiline
              rows={3}
              placeholder="Opcional"
            />
            <p className="text-xs text-muted-foreground">
              A solicitação vai para Fernanda confirmar. Você recebe um aviso assim que ela
              responder.
            </p>
          </div>
        ) : null}
      </BottomSheet>

      <Modal
        open={cancel}
        onClose={() => setCancel(false)}
        tone="danger"
        title="Cancelar seu horário?"
        subtitle="Faltam menos de 24 horas — Fernanda precisa aprovar o cancelamento."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setCancel(false)}>
              Manter
            </Button>
            <Button type="button" variant="danger" onClick={() => setCancel(false)}>
              Pedir cancelamento
            </Button>
          </>
        }
      />

      <ToastHost
        toast={
          sent
            ? { message: "Solicitação enviada", detail: "Fernanda responde em até 24 horas." }
            : null
        }
      />
    </div>
  );
}
