import {
  appointmentsDb,
  careDb,
  clientsDb,
  ledgerDb,
  proceduresDb,
  sessionsDb,
  stockDb,
} from "@/data/db";
import { logActivity } from "@/services/activity.service";
import { addDays, todayISO } from "@/lib/dates";
import type { ProcedureRec, SessionRec } from "@/lib/models";
import { suggestReturn } from "@/services/appointments.service";
import { updateClient } from "@/services/clients.service";
import { addLedgerEntry, consumeStock } from "@/services/finance.service";
import { events } from "@/services/notification-events";
import { notify } from "@/services/notify";

/** Se os produtos passam desta fatia do valor cobrado, a esteticista é avisada. */
export const MARGIN_ALERT = 0.35;

const newId = () => `se-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const find = (id: string) => sessionsDb.get().find((item) => item.id === id);

export const sessionTotals = (session: Pick<SessionRec, "procedures" | "products">) => {
  const price = session.procedures.reduce((sum, item) => sum + item.price, 0);
  const cost = session.products.reduce((sum, item) => sum + item.qty * item.unitCost, 0);
  return { price, cost, profit: price - cost, share: price > 0 ? cost / price : 0 };
};

/** Cadastra um procedimento no catálogo (também usado na hora, dentro do atendimento). */
export function saveProcedure(input: Omit<ProcedureRec, "id"> & { id?: string }): ProcedureRec {
  const existing = proceduresDb
    .get()
    .find(
      (item) => item.id === input.id || item.name.toLowerCase() === input.name.trim().toLowerCase(),
    );
  const rec: ProcedureRec = {
    ...input,
    name: input.name.trim(),
    id: existing?.id ?? input.id ?? `p-${Date.now()}`,
  };
  proceduresDb.set((list) =>
    existing ? list.map((item) => (item.id === existing.id ? rec : item)) : [...list, rec],
  );
  return rec;
}

export function removeProcedure(id: string) {
  proceduresDb.set((list) => list.filter((item) => item.id !== id));
}

/**
 * Abre o atendimento: retoma o rascunho da mesma cliente (ou do mesmo horário) ou cria um novo.
 * Daqui em diante tudo é salvo a cada alteração.
 */
export function startSession(input: {
  clientId: string;
  procedure?: string;
  apptId?: string;
}): SessionRec | null {
  const open = sessionsDb
    .get()
    .find(
      (item) =>
        item.status === "draft" &&
        (input.apptId
          ? item.apptId === input.apptId
          : item.clientId === input.clientId && !item.apptId),
    );
  if (open) return open;
  const client = clientsDb.get().find((item) => item.id === input.clientId);
  if (!client) return null;
  const appt = input.apptId
    ? appointmentsDb.get().find((item) => item.id === input.apptId)
    : undefined;
  const name = input.procedure ?? appt?.procedure ?? "";
  const known = proceduresDb.get().find((item) => item.name === name);
  const rec: SessionRec = {
    id: newId(),
    apptId: input.apptId,
    clientId: client.id,
    client: client.name,
    initials: client.initials,
    procedure: name,
    step: 0,
    procedures: name ? [{ name, price: appt?.price || known?.price || 0 }] : [],
    products: [],
    notes: {},
    payment: appt?.payment && appt.payment !== "A definir" ? appt.payment : "Pix",
    paidNow: true,
    dueDate: addDays(todayISO(), 7),
    status: "draft",
    startedAt: new Date().toISOString(),
  };
  sessionsDb.set((list) => [...list, rec]);
  return rec;
}

/** Salva qualquer alteração do atendimento na hora. */
export function updateSession(id: string, patch: Partial<Omit<SessionRec, "id">>) {
  sessionsDb.set((list) =>
    list.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, ...patch };
      // O nome do atendimento acompanha os procedimentos realizados.
      if (patch.procedures)
        next.procedure = patch.procedures.map((p) => p.name).join(" + ") || item.procedure;
      return next;
    }),
  );
}

/** Rascunho que ainda não recebeu nada: some ao cancelar para não deixar lixo na lista. */
export function discardIfEmpty(id: string) {
  const session = find(id);
  if (!session || session.status !== "draft") return;
  const untouched =
    session.step === 0 &&
    !session.products.length &&
    !session.beforePhotoId &&
    !Object.values(session.notes).some(Boolean) &&
    !session.apptId;
  if (untouched) sessionsDb.set((list) => list.filter((item) => item.id !== id));
}

export function cancelSession(id: string) {
  sessionsDb.set((list) => list.filter((item) => item.id !== id));
}

/**
 * Fecha o atendimento: caixa (pago agora ou a receber), baixa de estoque, custo de produto,
 * cuidados para a cliente, retorno aguardando confirmação e ficha atualizada.
 */
export function completeSession(
  id: string,
  closing: { cuidados: string[]; retorno: { data: string; hora: string } | null },
) {
  const session = find(id);
  if (!session || session.status === "done") return;
  const { price, share } = sessionTotals(session);
  const today = todayISO();
  const nowTime = new Date().toTimeString().slice(0, 5);
  const label = session.procedure || "Atendimento";

  sessionsDb.set((list) =>
    list.map((item) =>
      item.id === id ? { ...item, status: "done", finishedAt: new Date().toISOString() } : item,
    ),
  );

  const appt = session.apptId
    ? appointmentsDb.get().find((item) => item.id === session.apptId)
    : undefined;
  if (appt) {
    appointmentsDb.set((list) =>
      list.map((item) =>
        item.id === appt.id
          ? {
              ...item,
              done: true,
              status: "confirmed",
              price,
              payment: session.payment,
              procedure: label,
            }
          : item,
      ),
    );
  } else {
    appointmentsDb.set((list) => [
      ...list,
      {
        id: `ap-${session.id}`,
        clientId: session.clientId,
        client: session.client,
        initials: session.initials,
        procedure: label,
        date: today,
        time: nowTime,
        duration: 60,
        price,
        payment: session.payment,
        status: "confirmed",
        kind: "retorno",
        origin: "gestor",
        done: true,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  if (price > 0) {
    addLedgerEntry(
      session.paidNow
        ? {
            kind: "entradas",
            date: today,
            label: session.client,
            origin: label,
            method: session.payment,
            value: price,
            clientId: session.clientId,
            refId: session.id,
          }
        : {
            kind: "receber",
            date: today,
            due: session.dueDate,
            label: session.client,
            origin: label,
            method: session.payment,
            value: price,
            clientId: session.clientId,
            refId: session.id,
          },
    );
  }
  if (session.products.length) consumeStock(session.products);
  if (price > 0 && share > MARGIN_ALERT)
    notify(events.marginAlert(session.client, label, share, session.id));

  if (closing.cuidados.length) {
    const createdAt = new Date().toISOString();
    careDb.set((list) => [
      ...closing.cuidados.map((text, index) => ({
        id: `care-${Date.now()}-${index}`,
        clientId: session.clientId,
        text,
        createdAt,
        ...(/manh|protetor/i.test(text)
          ? { reminderTime: "08:00", until: addDays(today, 30) }
          : /noite|dormir/i.test(text)
            ? { reminderTime: "21:00", until: addDays(today, 30) }
            : {}),
      })),
      ...list,
    ]);
    notify(events.careNew(session.clientId, closing.cuidados.length, "sua esteticista"));
  }

  if (closing.retorno)
    suggestReturn(
      {
        clientId: session.clientId,
        client: session.client,
        initials: session.initials,
        procedure: label,
        price,
        payment: session.payment,
      },
      closing.retorno.data,
      closing.retorno.hora,
    );

  updateClient(session.clientId, {
    lastVisit: "hoje",
    mainProcedure: session.procedures[0]?.name ?? label,
  });
}

/** Produtos em falta para o que o atendimento pede (usado para avisar antes de finalizar). */
export const shortOnStock = (session: Pick<SessionRec, "products">) =>
  session.products.filter((used) => {
    const item = stockDb.get().find((entry) => entry.id === used.stockId);
    return item ? used.qty > item.quantity : false;
  });

/** Corrige um atendimento já finalizado: procedimentos, valores, forma de pagamento e anotações. O caixa e a agenda acompanham. */
export function editFinishedSession(
  id: string,
  patch: Pick<SessionRec, "procedures" | "notes" | "payment">,
) {
  const session = find(id);
  if (!session || session.status !== "done") return;
  const procedure = patch.procedures.map((item) => item.name).join(" + ") || session.procedure;
  const price = patch.procedures.reduce((sum, item) => sum + item.price, 0);
  sessionsDb.set((list) =>
    list.map((item) => (item.id === id ? { ...item, ...patch, procedure } : item)),
  );
  const apptId = session.apptId ?? `ap-${id}`;
  appointmentsDb.set((list) =>
    list.map((item) =>
      item.id === apptId ? { ...item, procedure, price, payment: patch.payment } : item,
    ),
  );
  ledgerDb.set((list) =>
    list.map((item) =>
      item.refId === id
        ? { ...item, origin: procedure, value: price, method: patch.payment }
        : item,
    ),
  );
  logActivity({
    by: "gestor",
    kind: "atendimento",
    clientId: session.clientId,
    client: session.client,
    text: `Corrigiu o atendimento: ${procedure}`,
  });
}

/** Apaga um atendimento lançado por engano: sai do caixa, volta o estoque e a agenda. */
export function deleteFinishedSession(id: string) {
  const session = find(id);
  if (!session || session.status !== "done") return;
  sessionsDb.set((list) => list.filter((item) => item.id !== id));
  ledgerDb.set((list) => list.filter((item) => item.refId !== id));
  stockDb.set((list) =>
    list.map((item) => {
      const used = session.products.find((entry) => entry.stockId === item.id);
      return used
        ? { ...item, quantity: Math.round((item.quantity + used.qty) * 100) / 100 }
        : item;
    }),
  );
  if (session.apptId)
    appointmentsDb.set((list) =>
      list.map((item) => (item.id === session.apptId ? { ...item, done: false } : item)),
    );
  else appointmentsDb.set((list) => list.filter((item) => item.id !== `ap-${id}`));
  logActivity({
    by: "gestor",
    kind: "atendimento",
    clientId: session.clientId,
    client: session.client,
    text: `Apagou o atendimento: ${session.procedure}`,
  });
}
