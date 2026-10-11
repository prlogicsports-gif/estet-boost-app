/** Nome do procedimento para frases; horário sem procedimento definido não pode deixar a frase cortada. */
export const procLabel = (procedure?: string | null) =>
  procedure?.trim() || "procedimento a definir";

/** Conserta textos antigos do histórico que ficaram cortados ("Confirmou o horário de"). */
export function completeActivityText(text: string) {
  const t = text.trim();
  if (/\b(de|do|da|em|para|a)$/i.test(t)) return `${t} ${procLabel("")}`;
  return t
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
