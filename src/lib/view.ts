import type { Appointment } from "@/components/eb/appointment-card";
import type { CalendarEvents } from "@/components/eb/calendar";
import type { AppointmentRec } from "@/lib/models";

export const brl = (value: number) => `R$ ${Math.round(value).toLocaleString("pt-BR")}`;

/** Atendimento do banco no formato do card. */
export function toCard(rec: AppointmentRec): Appointment & { done?: boolean } {
  return {
    id: rec.id,
    clientId: rec.clientId,
    time: rec.time,
    client: rec.client,
    initials: rec.initials,
    procedure: rec.procedure,
    kind: rec.kind,
    ...(rec.session ? { session: rec.session } : {}),
    ...(rec.sessionsTotal ? { sessionsTotal: rec.sessionsTotal } : {}),
    status: rec.status,
    price: brl(rec.price),
    ...(rec.alert
      ? { alert: rec.alert }
      : rec.request
        ? { alert: "Aguardando sua aprovação" }
        : rec.status === "pending"
          ? { alert: "Sem confirmação" }
          : {}),
    ...(rec.done ? { done: true } : {}),
  };
}

/** Calendário: atendimentos por dia, ordenados por horário. */
export function eventsFrom(list: AppointmentRec[]): CalendarEvents {
  const out: CalendarEvents = {};
  for (const rec of [...list].sort((a, b) => a.time.localeCompare(b.time))) {
    out[rec.date] = [
      ...(out[rec.date] ?? []),
      { time: rec.time, client: rec.client, status: rec.status },
    ];
  }
  return out;
}

export const byDateTime = (a: AppointmentRec, b: AppointmentRec) =>
  `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`);
