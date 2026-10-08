import { appointmentsDb, careDb, clientsDb } from "@/data/db";
import { formatWeekday, todayISO, addDays } from "@/lib/dates";
import type { AppointmentRec, AppointmentStatus } from "@/lib/models";
import { addLedgerEntry, consumeStock } from "@/services/finance.service";
import { createClient } from "@/services/clients.service";
import { notify } from "@/services/notify";

const newId = () => `ap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const update = (id: string, patch: Partial<AppointmentRec>) =>
  appointmentsDb.set((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
const find = (id: string) => appointmentsDb.get().find((item) => item.id === id);
const when = (a: Pick<AppointmentRec, "date" | "time">) => `${formatWeekday(a.date)} · ${a.time}`;

export type NewAppointment = {
  /** Cliente da carteira; sem id, `clientName` cria uma nova. */
  clientId?: string;
  clientName: string;
  procedure: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  payment: string;
  notes?: string;
  sendConfirmation: boolean;
};

/** A esteticista agenda: já nasce confirmado, e a cliente é avisada se a confirmação estiver marcada. */
export function scheduleAppointment(input: NewAppointment): AppointmentRec {
  const client =
    (input.clientId ? clientsDb.get().find((item) => item.id === input.clientId) : undefined) ??
    createClient({ name: input.clientName });
  const rec: AppointmentRec = {
    id: newId(),
    clientId: client.id,
    client: client.name,
    initials: client.initials,
    procedure: input.procedure,
    date: input.date,
    time: input.time,
    duration: input.duration,
    price: input.price,
    payment: input.payment,
    status: "confirmed",
    kind: client.lastVisit === "—" ? "primeira" : "retorno",
    origin: "gestor",
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };
  appointmentsDb.set((list) => [...list, rec]);
  if (input.sendConfirmation) {
    notify({
      audience: "cliente",
      clientId: client.id,
      kind: "reminder",
      title: "Novo horário agendado",
      body: `${rec.procedure} · ${when(rec)}`,
      href: "/cliente/agenda",
    });
  }
  return rec;
}

/** A cliente pede um horário: fica aguardando e a esteticista é avisada. */
export function requestAppointment(input: {
  clientId: string;
  procedure: string;
  date: string;
  time: string;
  notes?: string;
}): AppointmentRec | null {
  const client = clientsDb.get().find((item) => item.id === input.clientId);
  if (!client) return null;
  const rec: AppointmentRec = {
    id: newId(),
    clientId: client.id,
    client: client.name,
    initials: client.initials,
    procedure: input.procedure,
    date: input.date,
    time: input.time,
    duration: 60,
    price: 0,
    payment: "A definir",
    status: "pending",
    kind: client.lastVisit === "—" ? "primeira" : "retorno",
    origin: "cliente",
    request: true,
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };
  appointmentsDb.set((list) => [...list, rec]);
  notify({
    audience: "gestor",
    kind: "request",
    title: "Nova solicitação de horário",
    body: `${client.name} · ${when(rec)}`,
    href: "/agenda",
  });
  return rec;
}

export function approveRequest(id: string) {
  const a = find(id);
  if (!a) return;
  update(id, { status: "confirmed", request: false, alert: undefined });
  notify({
    audience: "cliente",
    clientId: a.clientId,
    kind: "confirmed",
    title: "Horário confirmado",
    body: `${a.procedure} · ${when(a)}`,
    href: "/cliente/agenda",
  });
}

export function declineRequest(id: string) {
  const a = find(id);
  if (!a) return;
  update(id, { status: "cancelled", request: false });
  notify({
    audience: "cliente",
    clientId: a.clientId,
    kind: "reschedule",
    title: "Horário não disponível",
    body: `${formatWeekday(a.date)} não está livre. Peça outro horário.`,
    href: "/cliente/agenda",
  });
}

export function confirmAppointment(id: string, by: "gestor" | "cliente") {
  const a = find(id);
  if (!a) return;
  update(id, { status: "confirmed", alert: undefined });
  if (by === "cliente") {
    notify({
      audience: "gestor",
      kind: "confirmed",
      title: `${a.client.split(" ")[0]} confirmou presença`,
      body: `${a.procedure} · ${when(a)}`,
      href: `/atendimentos/${a.id}`,
    });
  } else {
    notify({
      audience: "cliente",
      clientId: a.clientId,
      kind: "confirmed",
      title: "Horário confirmado",
      body: `${a.procedure} · ${when(a)}`,
      href: "/cliente/agenda",
    });
  }
}

export function cancelAppointment(id: string, by: "gestor" | "cliente") {
  const a = find(id);
  if (!a) return;
  if (by === "cliente") {
    const hours = (new Date(`${a.date}T${a.time}:00`).getTime() - Date.now()) / 3600000;
    if (hours < 24) {
      // Menos de 24 horas: a esteticista precisa aprovar.
      update(id, { cancelRequest: true });
      notify({
        audience: "gestor",
        kind: "reschedule",
        title: "Pedido de cancelamento",
        body: `${a.client} · ${when(a)} (menos de 24 h)`,
        href: `/atendimentos/${a.id}`,
      });
      return;
    }
    update(id, { status: "cancelled" });
    notify({
      audience: "gestor",
      kind: "reschedule",
      title: "Horário cancelado",
      body: `${a.client} · ${when(a)}`,
      href: "/agenda",
    });
    return;
  }
  update(id, { status: "cancelled", cancelRequest: false });
  notify({
    audience: "cliente",
    clientId: a.clientId,
    kind: "reschedule",
    title: "Atendimento cancelado",
    body: `${a.procedure} · ${when(a)}. A sessão volta para o pacote.`,
    href: "/cliente/agenda",
  });
}

export function approveCancel(id: string) {
  cancelAppointment(id, "gestor");
}

/** A cliente propõe outro dia e horário. */
export function requestReschedule(id: string, date: string, time: string) {
  const a = find(id);
  if (!a) return;
  update(id, { reschedule: true, proposedDate: date, proposedTime: time });
  notify({
    audience: "gestor",
    kind: "reschedule",
    title: "Pedido de remarcação",
    body: `${a.client} propõe ${formatWeekday(date)} · ${time}`,
    href: `/atendimentos/${a.id}`,
  });
}

export function approveReschedule(id: string) {
  const a = find(id);
  if (!a || !a.proposedDate || !a.proposedTime) return;
  update(id, {
    date: a.proposedDate,
    time: a.proposedTime,
    reschedule: false,
    proposedDate: undefined,
    proposedTime: undefined,
    status: "confirmed",
  });
  notify({
    audience: "cliente",
    clientId: a.clientId,
    kind: "confirmed",
    title: "Remarcação confirmada",
    body: `${a.procedure} · ${formatWeekday(a.proposedDate)} · ${a.proposedTime}`,
    href: "/cliente/agenda",
  });
}

export function declineReschedule(id: string) {
  const a = find(id);
  if (!a) return;
  update(id, { reschedule: false, proposedDate: undefined, proposedTime: undefined });
  notify({
    audience: "cliente",
    clientId: a.clientId,
    kind: "reschedule",
    title: "Remarcação não confirmada",
    body: `Seu horário continua em ${when(a)}.`,
    href: "/cliente/agenda",
  });
}

/** A esteticista move o horário: a cliente é avisada. */
export function rescheduleAppointment(id: string, date: string, time: string) {
  const a = find(id);
  if (!a) return;
  update(id, { date, time, reschedule: false, proposedDate: undefined, proposedTime: undefined });
  notify({
    audience: "cliente",
    clientId: a.clientId,
    kind: "reschedule",
    title: "Horário alterado",
    body: `${a.procedure} passou para ${formatWeekday(date)} · ${time}`,
    href: "/cliente/agenda",
  });
}

export type CompletedSession = {
  /** Valor cobrado e como foi pago. */
  price: number;
  payment: string;
  products: string[];
  cuidados: string[];
  retorno: { data: string; hora: string } | null;
};

/** Fecha o atendimento: caixa, estoque, cuidados para a cliente e retorno aguardando confirmação. */
export function completeAppointment(
  a: { id: string; clientId: string; client: string; initials: string; procedure: string },
  session: CompletedSession,
) {
  const known = find(a.id);
  if (known)
    update(a.id, {
      done: true,
      status: "confirmed",
      price: session.price,
      payment: session.payment,
    });
  else {
    appointmentsDb.set((list) => [
      ...list,
      {
        id: a.id,
        clientId: a.clientId,
        client: a.client,
        initials: a.initials,
        procedure: a.procedure,
        date: todayISO(),
        time: new Date().toTimeString().slice(0, 5),
        duration: 60,
        price: session.price,
        payment: session.payment,
        status: "confirmed",
        kind: "retorno",
        origin: "gestor",
        done: true,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  if (session.price > 0) {
    addLedgerEntry({
      kind: "entradas",
      date: todayISO(),
      label: a.client,
      origin: a.procedure,
      method: session.payment,
      value: session.price,
    });
  }
  if (session.products.length) consumeStock(session.products);

  if (session.cuidados.length) {
    const createdAt = new Date().toISOString();
    careDb.set((list) => [
      ...session.cuidados.map((text, index) => ({
        id: `care-${Date.now()}-${index}`,
        clientId: a.clientId,
        text,
        createdAt,
        ...(/manh|protetor/i.test(text)
          ? { reminderTime: "08:00", until: addDays(todayISO(), 30) }
          : /noite|dormir/i.test(text)
            ? { reminderTime: "21:00", until: addDays(todayISO(), 30) }
            : {}),
      })),
      ...list,
    ]);
    notify({
      audience: "cliente",
      clientId: a.clientId,
      kind: "recommendation",
      title: "Novos cuidados de Fernanda",
      body: `${session.cuidados.length} recomendações para você`,
      href: "/cliente/evolucao",
    });
  }

  if (session.retorno) {
    const rec: AppointmentRec = {
      id: newId(),
      clientId: a.clientId,
      client: a.client,
      initials: a.initials,
      procedure: a.procedure,
      date: session.retorno.data,
      time: session.retorno.hora,
      duration: 60,
      price: session.price,
      payment: session.payment,
      status: "pending",
      kind: "retorno",
      origin: "gestor",
      createdAt: new Date().toISOString(),
    };
    appointmentsDb.set((list) => [...list, rec]);
    notify({
      audience: "cliente",
      clientId: a.clientId,
      kind: "reminder",
      title: "Retorno sugerido",
      body: `${a.procedure} · ${when(rec)}. Confirme sua presença.`,
      href: "/cliente/agenda",
    });
  }
}

export const statusLabel: Record<AppointmentStatus, string> = {
  confirmed: "Confirmado",
  pending: "Aguardando",
  cancelled: "Cancelado",
};
