import type { BlockRec, HoursRec } from "@/lib/models";

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
): string | undefined {
  const day = hours.days[weekdayOf(date)];
  if (!day?.open) return "A agenda não atende nesse dia.";
  if (time < day.start || time >= day.end)
    return `Fora do horário de atendimento (${day.start} às ${day.end}).`;
  const block = blocks.find((item) => item.date === date && time >= item.start && time < item.end);
  if (block) return `Horário bloqueado${block.reason ? `: ${block.reason}` : ""}.`;
  return undefined;
}

/** Horários possíveis do dia, no intervalo configurado, já sem os bloqueios. */
export function slotsFor(date: string, hours: HoursRec, blocks: BlockRec[]): string[] {
  const day = hours.days[weekdayOf(date)];
  if (!day?.open) return [];
  const list: string[] = [];
  for (let at = toMinutes(day.start); at < toMinutes(day.end); at += hours.slot) {
    const time = toTime(at);
    if (!unavailableReason(date, time, hours, blocks)) list.push(time);
  }
  return list;
}
