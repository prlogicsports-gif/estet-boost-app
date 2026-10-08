/** Datas do app, sempre no fuso do aparelho e no formato ISO `AAAA-MM-DD`. */
const pad = (n: number) => String(n).padStart(2, "0");

export const toISO = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const todayISO = () => toISO(new Date());
export const nowHM = () => {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

const at = (iso: string) => new Date(`${iso}T12:00:00`);

export function addDays(iso: string, days: number) {
  const date = at(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

export const daysBetween = (from: string, to: string) =>
  Math.round((at(to).getTime() - at(from).getTime()) / 86400000);

/** Dia em que os dados de exemplo "estão": eles são deslocados para que esse dia seja hoje. */
export const SEED_REFERENCE_DAY = "2026-09-01";
export const shiftSeedDate = (iso: string) =>
  addDays(iso, daysBetween(SEED_REFERENCE_DAY, todayISO()));

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "Terça, 1 de setembro de 2026" */
export const formatLong = (iso: string) =>
  capital(
    at(iso).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  ).replace(/^(\p{L}+)-feira/u, "$1");

/** "terça-feira, 01 de setembro" */
export const formatWeekday = (iso: string) =>
  at(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

/** "04 ago" */
export const formatShort = (iso: string) =>
  at(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");

export const monthName = (iso: string) =>
  capital(at(iso).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));

/** Hoje, Ontem, Amanhã ou a data curta. */
export function relativeDay(iso: string) {
  const diff = daysBetween(todayISO(), iso);
  if (diff === 0) return "Hoje";
  if (diff === -1) return "Ontem";
  if (diff === 1) return "Amanhã";
  return formatShort(iso);
}

/** "agora", "12 min", "3 h", "ontem", "5 dias" a partir de um instante ISO. */
export function timeAgo(isoInstant: string) {
  const minutes = Math.round((Date.now() - new Date(isoInstant).getTime()) / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "ontem" : `${days} dias`;
}

export const instantOf = (iso: string, hm: string) => new Date(`${iso}T${hm}:00`).toISOString();
