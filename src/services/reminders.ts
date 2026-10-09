import {
  appointmentsDb,
  billsDb,
  careDb,
  clientsDb,
  defaultPrefs,
  ledgerDb,
  prefsDb,
  stockDb,
} from "@/data/db";
import { addDays, daysBetween, instantOf, todayISO } from "@/lib/dates";
import { events } from "@/services/notification-events";
import { notify } from "@/services/notify";

/** Avisos de validade: 30 dias antes o produto entra no radar da esteticista. */
const EXPIRY_WINDOW = 30;

/**
 * Regras de lembrete. Cada uma gera no máximo uma notificação por chave, então rodar
 * isto a cada minuto é seguro. Estas são as mesmas regras que um agendador na nuvem
 * (Cloud Functions + FCM) vai executar quando o banco entrar: veja docs/NOTIFICACOES-FIREBASE.md.
 * O texto de cada aviso vem de `notification-events.ts`.
 */
export function runReminders(now = new Date()): number {
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const prefs = prefsDb.get();
  const gestor = { ...defaultPrefs, ...prefs["gestor"] };
  const cliente = { ...defaultPrefs, ...prefs["cliente"] };
  let created = 0;
  const push = (draft: Parameters<typeof notify>[0]) => {
    notify(draft);
    created += 1;
  };

  const appointments = appointmentsDb
    .get()
    .filter((item) => !item.done && item.status !== "cancelled");
  const clients = clientsDb.get();

  // ── esteticista ──
  if (gestor.appointments) {
    for (const a of appointments) {
      if (a.date !== today) continue;
      const start = Number(a.time.slice(0, 2)) * 60 + Number(a.time.slice(3, 5));
      if (a.status === "pending" && !a.request) push(events.unconfirmed(a, today));
      const until = start - minutesNow;
      if (until >= 0 && until <= 60) push(events.startsSoon(a, until));
    }
  }

  if (gestor.payments) {
    for (const bill of billsDb.get()) {
      if (bill.paid) continue;
      const days = daysBetween(today, bill.due);
      if (days >= 0 && days <= 3) push(events.billDue(bill, days, today));
      else if (days < 0) push(events.billLate(bill, -days, today));
    }
    for (const entry of ledgerDb.get()) {
      if (entry.kind !== "receber" || entry.reported) continue;
      const days = daysBetween(today, entry.due ?? entry.date);
      if (days >= 0 && days <= 3) push(events.receivableDue(entry, days, today));
    }
  }

  if (gestor.stock) {
    for (const item of stockDb.get()) {
      if (item.quantity <= item.min) push(events.stockLow(item));
      if (item.expiry) {
        const days = daysBetween(today, item.expiry);
        if (days < 0) push(events.stockExpired(item));
        else if (days <= EXPIRY_WINDOW) push(events.stockExpiring(item, days));
      }
    }
  }

  if (gestor.appointments) {
    for (const client of clients) {
      if (client.alert === "Sem atendimento recente") push(events.clientCold(client));
    }
  }

  // ── cliente ──
  if (cliente.appointments) {
    for (const a of appointments) {
      if (a.date === tomorrow) push(events.remindTomorrow(a));
      else if (a.date === today) push(events.remindToday(a));
    }
  }

  if (cliente.payments) {
    for (const entry of ledgerDb.get()) {
      if (entry.kind !== "receber" || entry.reported || !entry.clientId) continue;
      const days = daysBetween(today, entry.due ?? entry.date);
      if (days >= 0 && days <= 3) push(events.paymentDue(entry, days, today));
    }
  }

  if (cliente.recommendations) {
    for (const care of careDb.get()) {
      if (!care.reminderTime || (care.until && care.until < today)) continue;
      const at = Number(care.reminderTime.slice(0, 2)) * 60 + Number(care.reminderTime.slice(3, 5));
      if (minutesNow < at) continue;
      push(events.careReminder(care, today, instantOf(today, care.reminderTime)));
    }
  }

  return created;
}
