/** Números do Dashboard: funções puras sobre os dados da clínica (testadas em tests/metrics.test.ts). */
import { addDays, daysBetween, toISO } from "@/lib/dates";
import type {
  AppointmentRec,
  BlockRec,
  HoursRec,
  LedgerEntry,
  LedgerKind,
  SessionRec,
} from "@/lib/models";

/** Intervalo de datas ISO, com os dois extremos incluídos. */
export type Range = { from: string; to: string };
export type PeriodId = "mes" | "anterior" | "30d";

export const inRange = (date: string, range: Range) => date >= range.from && date <= range.to;

const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
const monthEnd = (iso: string) => addDays(addDays(monthStart(iso), 32).slice(0, 7) + "-01", -1);

export function periodRange(id: PeriodId, today: string): Range {
  if (id === "mes") return { from: monthStart(today), to: today };
  if (id === "anterior") {
    const last = addDays(monthStart(today), -1);
    return { from: monthStart(last), to: monthEnd(last) };
  }
  return { from: addDays(today, -29), to: today };
}

/** O período equivalente imediatamente antes (para comparar). */
export function previousRange(range: Range): Range {
  const days = daysBetween(range.from, range.to) + 1;
  return { from: addDays(range.from, -days), to: addDays(range.from, -1) };
}

export const sumLedger = (entries: LedgerEntry[], kind: LedgerKind, range: Range) =>
  entries
    .filter((entry) => entry.kind === kind && inRange(entry.date, range))
    .reduce((total, entry) => total + entry.value, 0);

/** Atendimentos realizados no período. */
export const doneAppointments = (appointments: AppointmentRec[], range: Range) =>
  appointments.filter((item) => item.done && inRange(item.date, range));

export const newClients = (clients: { createdAt: string }[], range: Range) =>
  clients.filter((client) => inRange(toISO(new Date(client.createdAt)), range));

/** Quantos atendimentos do período foram retornos, em %. */
export function returnShare(done: AppointmentRec[]) {
  if (!done.length) return 0;
  return Math.round((done.filter((item) => item.kind === "retorno").length / done.length) * 100);
}

export const average = (total: number, count: number) => (count ? total / count : 0);

/** Variação em relação ao período anterior, em %; `null` quando não há base para comparar. */
export const change = (now: number, before: number) =>
  before > 0 ? Math.round(((now - before) / before) * 100) : null;

const mondayOf = (iso: string) => {
  const offset = (new Date(`${iso}T12:00:00`).getDay() + 6) % 7;
  return addDays(iso, -offset);
};

/** Entradas do caixa por semana (segunda a domingo) dentro do período. */
export function weeklyIncome(entries: LedgerEntry[], range: Range) {
  const weeks: { from: string; value: number }[] = [];
  for (let week = mondayOf(range.from); week <= range.to; week = addDays(week, 7))
    weeks.push({ from: week, value: 0 });
  for (const entry of entries) {
    if (entry.kind !== "entradas" || !inRange(entry.date, range)) continue;
    const bucket = weeks.find((item) => item.from === mondayOf(entry.date));
    if (bucket) bucket.value += entry.value;
  }
  return weeks;
}

/** Procedimentos mais realizados (atendimentos finalizados no período), por quantidade. */
export function topProcedures(sessions: SessionRec[], range: Range, limit = 5) {
  const map = new Map<string, { name: string; count: number; revenue: number }>();
  for (const session of sessions) {
    if (session.status !== "done" || !session.finishedAt) continue;
    if (!inRange(session.finishedAt.slice(0, 10), range)) continue;
    for (const procedure of session.procedures) {
      const entry = map.get(procedure.name) ?? { name: procedure.name, count: 0, revenue: 0 };
      entry.count += 1;
      entry.revenue += procedure.price;
      map.set(procedure.name, entry);
    }
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
    .slice(0, limit);
}

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Ocupação da agenda: minutos marcados sobre os minutos abertos (horário de atendimento menos bloqueios). */
export function occupancy(
  appointments: AppointmentRec[],
  hours: HoursRec,
  blocks: BlockRec[],
  range: Range,
) {
  let available = 0;
  let booked = 0;
  for (let day = range.from; day <= range.to; day = addDays(day, 1)) {
    const config = hours.days[String(new Date(`${day}T12:00:00`).getDay())];
    if (!config?.open) continue;
    const open = minutes(config.start);
    const close = minutes(config.end);
    let free = Math.max(0, close - open);
    for (const block of blocks) {
      if (block.date !== day) continue;
      const overlap = Math.min(close, minutes(block.end)) - Math.max(open, minutes(block.start));
      if (overlap > 0) free -= overlap;
    }
    available += Math.max(0, free);
    booked += appointments
      .filter((item) => item.date === day && item.status !== "cancelled")
      .reduce((total, item) => total + item.duration, 0);
  }
  const pct = available > 0 ? Math.min(100, Math.round((booked / available) * 100)) : 0;
  return { available, booked, pct };
}
