import { addDays } from "@/lib/dates";
import type { BlockRec, HoursRec } from "@/lib/models";

export const MAX_BLOCK_DAYS = 92;

/** Datas de `from` até `to` (inclusive), no máximo MAX_BLOCK_DAYS. */
export function daysInRange(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to && days.length < MAX_BLOCK_DAYS; day = addDays(day, 1))
    days.push(day);
  return days;
}

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const weekdayOf = (date: string) => String(new Date(`${date}T12:00:00`).getDay());

/** Por que esse dia e horário não podem ser usados (ou `undefined` se estão livres). */
export function unavailableReason(
  date: string,
  time: string,
  hours: HoursRec,
  blocks: BlockRec[],
  /** Duração do atendimento em minutos: um atendimento que invade o bloqueio seguinte também é recusado. */
  duration = 0,
): string | undefined {
  const day = hours.days[weekdayOf(date)];
  if (!day?.open) return "A agenda não atende nesse dia.";
  if (time < day.start || time >= day.end)
    return `Fora do horário de atendimento (${day.start} às ${day.end}).`;
  const startAt = toMinutes(time);
  const endAt = startAt + Math.max(duration, 1);
  const block = blocks.find(
    (item) => item.date === date && time < item.end && endAt > toMinutes(item.start),
  );
  if (block) return `Horário bloqueado${block.reason ? `: ${block.reason}` : ""}.`;
  return undefined;
}

/** Horários possíveis do dia, no intervalo configurado, já sem os bloqueios. */
export function slotsFor(
  date: string,
  hours: HoursRec,
  blocks: BlockRec[],
  duration = 0,
): string[] {
  const day = hours.days[weekdayOf(date)];
  if (!day?.open) return [];
  const list: string[] = [];
  for (let at = toMinutes(day.start); at < toMinutes(day.end); at += hours.slot) {
    const time = toTime(at);
    if (!unavailableReason(date, time, hours, blocks, duration)) list.push(time);
  }
  return list;
}
