import { logActivity } from "@/services/activity.service";
import { appointmentsDb, clientsDb } from "@/data/db";
import type { AppointmentRec, AppointmentStatus } from "@/lib/models";
import { currentRole } from "@/lib/session";
import { runRpc } from "@/lib/remote-store";
import { newId } from "@/lib/uuid";
import { createClient } from "@/services/clients.service";
import { events } from "@/services/notification-events";
import { notify } from "@/services/notify";

const update = (id: string, patch: Partial<AppointmentRec>) =>
  appointmentsDb.set((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
const find = (id: string) => appointmentsDb.get().find((item) => item.id === id);

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
  if (input.sendConfirmation) notify(events.appointmentScheduled(rec));
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
  notify(events.appointmentRequested(rec));
  logActivity({
    by: "cliente",
    kind: "horario",
    clientId: client.id,
    client: client.name,
    text: `Solicitou ${rec.procedure} em ${rec.date.split("-").reverse().join("/")} às ${rec.time}`,
  });
  return rec;
}

export function approveRequest(id: string) {
  const a = find(id);
  if (!a) return;
  update(id, { status: "confirmed", request: false, alert: undefined });
  notify(events.requestApproved(a));
  logActivity({
    by: "gestor",
    kind: "horario",
    clientId: a.clientId,
    client: a.client,
    text: `Aprovou o horário de ${a.procedure} (${a.time})`,
  });
}

export function declineRequest(id: string) {
  const a = find(id);
  if (!a) return;
  update(id, { status: "cancelled", request: false });
  notify(events.requestDeclined(a));
  logActivity({
    by: "gestor",
    kind: "horario",
    clientId: a.clientId,
    client: a.client,
    text: `Recusou o horário solicitado (${a.time})`,
  });
}

export function confirmAppointment(id: string, by: "gestor" | "cliente") {
  const a = find(id);
  if (!a) return;
  if (by === "cliente" && currentRole() === "cliente") {
    // a cliente confirma o próprio horário por função do banco (ela não escreve na agenda)
    void runRpc("confirm_my_appointment", { p_appt_id: id }, { label: "Presença confirmada" }).then(
      () => appointmentsDb.reload(),
    );
  } else update(id, { status: "confirmed", alert: undefined });
  notify(by === "cliente" ? events.confirmedByClient(a) : events.confirmedByStudio(a));
  logActivity({
    by,
    kind: "horario",
    clientId: a.clientId,
    client: a.client,
    text:
      by === "cliente"
        ? `Confirmou presença em ${a.procedure}`
        : `Confirmou o horário de ${a.procedure}`,
  });
}

export function cancelAppointment(id: string, by: "gestor" | "cliente") {
  const a = find(id);
  if (!a) return;
  if (by === "cliente" && currentRole() === "cliente") {
    // o servidor decide (mais de 24 h cancela direto; menos pede aprovação), avisa a equipe e registra no histórico
    void runRpc("request_cancel", { p_appt_id: id }, { label: "Cancelamento de horário" }).then(
      () => appointmentsDb.reload(),
    );
    return;
  }
  if (by === "cliente") {
    const hours = (new Date(`${a.date}T${a.time}:00`).getTime() - Date.now()) / 3600000;
    if (hours < 24) {
      // Menos de 24 horas: a esteticista precisa aprovar.
      update(id, { cancelRequest: true });
      notify(events.cancelRequested(a));
      logActivity({
        by: "cliente",
        kind: "horario",
        clientId: a.clientId,
        client: a.client,
        text: `Pediu para cancelar ${a.procedure} (menos de 24 h)`,
      });
      return;
    }
    update(id, { status: "cancelled" });
    notify(events.cancelledByClient(a));
    logActivity({
      by: "cliente",
      kind: "horario",
      clientId: a.clientId,
      client: a.client,
      text: `Cancelou ${a.procedure}`,
    });
    return;
  }
  update(id, { status: "cancelled", cancelRequest: false });
  notify(events.cancelledByStudio(a));
  logActivity({
    by: "gestor",
    kind: "horario",
    clientId: a.clientId,
    client: a.client,
    text: `Cancelou ${a.procedure}`,
  });
}

export function approveCancel(id: string) {
  cancelAppointment(id, "gestor");
}

/** A cliente propõe outro dia e horário. */
export function requestReschedule(id: string, date: string, time: string) {
  const a = find(id);
  if (!a) return;
  if (currentRole() === "cliente") {
    void runRpc(
      "request_reschedule",
      { p_appt_id: id, p_date: date, p_time: time },
      { label: "Pedido de remarcação" },
    ).then(() => appointmentsDb.reload());
    return;
  }
  update(id, { reschedule: true, proposedDate: date, proposedTime: time });
  notify(events.rescheduleRequested(a, date, time));
  logActivity({
    by: "cliente",
    kind: "horario",
    clientId: a.clientId,
    client: a.client,
    text: `Pediu remarcação para ${date.split("-").reverse().join("/")} às ${time}`,
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
  notify(events.rescheduleApproved(a, a.proposedDate, a.proposedTime));
  logActivity({
    by: "gestor",
    kind: "horario",
    clientId: a.clientId,
    client: a.client,
    text: "Aprovou a remarcação",
  });
}

export function declineReschedule(id: string) {
  const a = find(id);
  if (!a) return;
  update(id, { reschedule: false, proposedDate: undefined, proposedTime: undefined });
  notify(events.rescheduleDeclined(a));
  logActivity({
    by: "gestor",
    kind: "horario",
    clientId: a.clientId,
    client: a.client,
    text: "Recusou a remarcação",
  });
}

/** A esteticista move o horário: a cliente é avisada. */
export function rescheduleAppointment(id: string, date: string, time: string) {
  const a = find(id);
  if (!a) return;
  update(id, { date, time, reschedule: false, proposedDate: undefined, proposedTime: undefined });
  notify(events.movedByStudio(a, date, time));
  logActivity({
    by: "gestor",
    kind: "horario",
    clientId: a.clientId,
    client: a.client,
    text: `Moveu o horário para ${date.split("-").reverse().join("/")} às ${time}`,
  });
}

/** Cria o retorno sugerido ao fechar um atendimento: fica aguardando a confirmação da cliente. */
export function suggestReturn(
  a: Pick<AppointmentRec, "clientId" | "client" | "initials" | "procedure" | "price" | "payment">,
  data: string,
  hora: string,
) {
  const rec: AppointmentRec = {
    id: newId(),
    clientId: a.clientId,
    client: a.client,
    initials: a.initials,
    procedure: a.procedure,
    date: data,
    time: hora,
    duration: 60,
    price: a.price,
    payment: a.payment,
    status: "pending",
    kind: "retorno",
    origin: "gestor",
    createdAt: new Date().toISOString(),
  };
  appointmentsDb.set((list) => [...list, rec]);
  notify(events.returnSuggested(rec));
  return rec;
}

export const statusLabel: Record<AppointmentStatus, string> = {
  confirmed: "Confirmado",
  pending: "Aguardando",
  cancelled: "Cancelado",
};
