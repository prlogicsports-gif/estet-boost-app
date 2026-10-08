import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/eb/icon";
import { Input } from "@/components/eb/input";
import { Drawer } from "@/components/eb/overlays";
import { Select } from "@/components/eb/select";
import { Button } from "@/components/ui/button";
import { appointmentsDb, clientsDb } from "@/data/db";
import { formatWeekday } from "@/lib/dates";
import { scheduleAppointment } from "@/services/appointments.service";
import type { AppointmentRec } from "@/lib/models";

export const PROCEDURES = [
  "Limpeza de pele profunda",
  "Peeling suave",
  "Hidratação facial",
  "Drenagem facial",
  "Avaliação inicial",
  "Microagulhamento",
];
const PAYMENTS = ["Pix", "Cartão de crédito", "Cartão de débito", "Dinheiro", "Transferência"];
export const PRICES: Record<string, number> = {
  "Limpeza de pele profunda": 180,
  "Peeling suave": 160,
  "Hidratação facial": 150,
  "Drenagem facial": 180,
  "Avaliação inicial": 120,
  Microagulhamento: 260,
};

type Form = {
  client: string;
  clientId: string;
  procedure: string;
  date: string;
  time: string;
  duration: string;
  price: string;
  payment: string;
  notes: string;
  confirm: boolean;
};

const blank = (date: string, clientId = "", client = ""): Form => ({
  client,
  clientId,
  procedure: PROCEDURES[0] ?? "",
  date,
  time: "11:00",
  duration: "60",
  price: String(PRICES[PROCEDURES[0] ?? ""] ?? 180),
  payment: "Pix",
  notes: "",
  confirm: true,
});

/** Novo agendamento: a cliente vem da carteira (ou é cadastrada na hora) e o horário não pode bater com outro. */
export function NewAppointmentDrawer({
  open,
  date,
  clientId,
  onClose,
  onCreated,
}: {
  open: boolean;
  date: string;
  clientId?: string | undefined;
  onClose: () => void;
  onCreated: (rec: AppointmentRec) => void;
}) {
  const clients = clientsDb.use();
  const appointments = appointmentsDb.use();
  const preset = clients.find((client) => client.id === clientId);
  const [form, setForm] = useState<Form>(() => blank(date, preset?.id, preset?.name));
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(blank(date, preset?.id, preset?.name));
      setTried(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, clientId]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const matches = useMemo(() => {
    const query = form.client.trim().toLowerCase();
    if (!query || form.clientId) return [];
    return clients.filter((client) => client.name.toLowerCase().includes(query)).slice(0, 4);
  }, [clients, form.client, form.clientId]);

  const clash = appointments.find(
    (item) =>
      item.date === form.date &&
      item.time === form.time &&
      item.status !== "cancelled" &&
      !item.done,
  );
  const errors = {
    client: form.client.trim() ? undefined : "Escolha ou digite o nome da cliente.",
    date: form.date ? undefined : "Escolha a data.",
    time: !form.time
      ? "Escolha o horário."
      : clash
        ? `Já existe atendimento às ${form.time} (${clash.client}).`
        : undefined,
  };
  const valid = !errors.client && !errors.date && !errors.time;

  function submit() {
    setTried(true);
    if (!valid) return;
    const rec = scheduleAppointment({
      ...(form.clientId ? { clientId: form.clientId } : {}),
      clientName: form.client,
      procedure: form.procedure,
      date: form.date,
      time: form.time,
      duration: Number(form.duration) || 60,
      price: Number(form.price.replace(",", ".")) || 0,
      payment: form.payment,
      notes: form.notes,
      sendConfirmation: form.confirm,
    });
    onCreated(rec);
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Novo agendamento"
      subtitle={form.date ? formatWeekday(form.date) : undefined}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="tech" className="flex-1" onClick={submit}>
            <Icon name="Check" size={18} /> Confirmar agendamento
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <Input
            label="Cliente"
            icon="Search"
            placeholder="Buscar ou criar cliente"
            value={form.client}
            error={tried ? errors.client : undefined}
            onChange={(event) =>
              setForm((current) => ({ ...current, client: event.target.value, clientId: "" }))
            }
          />
          {matches.length ? (
            <div className="flex flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)]">
              {matches.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() =>
                    setForm((current) => ({ ...current, client: client.name, clientId: client.id }))
                  }
                  className="flex min-h-11 items-center gap-2.5 border-b border-[var(--border-hairline)] px-3 text-left text-sm last:border-b-0"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-[var(--eb-nude-a32)] text-[11px]">
                    {client.initials}
                  </span>
                  {client.name}
                </button>
              ))}
            </div>
          ) : form.client.trim() && !form.clientId ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma cliente com esse nome: ela será cadastrada junto com o agendamento.
            </p>
          ) : null}
        </div>

        <Select
          label="Procedimento"
          options={PROCEDURES}
          value={form.procedure}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              procedure: event.target.value,
              price: String(PRICES[event.target.value] ?? current.price),
            }))
          }
        />
        <div className="grid grid-cols-2 gap-2.5">
          <Input
            label="Data"
            type="date"
            value={form.date}
            error={tried ? errors.date : undefined}
            onChange={(event) => set("date", event.target.value)}
          />
          <Input
            label="Horário"
            type="time"
            value={form.time}
            error={tried ? errors.time : undefined}
            onChange={(event) => set("time", event.target.value)}
          />
        </div>
        {!tried && clash ? (
          <p className="-mt-2 text-xs text-[var(--eb-amber-500)]">
            Já existe atendimento às {form.time} ({clash.client}).
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2.5">
          <Input
            label="Duração"
            trailing="min"
            inputMode="numeric"
            value={form.duration}
            onChange={(event) => set("duration", event.target.value)}
          />
          <Input
            label="Valor"
            trailing="R$"
            inputMode="decimal"
            value={form.price}
            onChange={(event) => set("price", event.target.value)}
          />
        </div>
        <Select
          label="Forma de pagamento prevista"
          options={PAYMENTS}
          value={form.payment}
          onChange={(event) => set("payment", event.target.value)}
        />
        <Input
          label="Observação"
          multiline
          rows={3}
          placeholder="Algo que você precisa lembrar?"
          value={form.notes}
          onChange={(event) => set("notes", event.target.value)}
        />
        <label className="flex min-h-11 items-center gap-2.5 text-[13.5px] text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={form.confirm}
            onChange={(event) => set("confirm", event.target.checked)}
            className="size-[18px] accent-[var(--teal)]"
          />
          Enviar confirmação para a cliente
        </label>
      </div>
    </Drawer>
  );
}
