import type { Invite } from "./auth.types";

/** Lê o link de cadastro: `?equipe=CODIGO` (funcionária), `?convite=CODIGO` (cliente) ou `?p=slug` (link da clínica). */
export function readInvite(search: string): Invite | null {
  const query = new URLSearchParams(search);
  const slug = query.get("p");
  const staffCode = query.get("equipe");
  const code = staffCode ?? query.get("convite");
  if (!slug && !code) return null;
  const professional =
    query.get("nome") ??
    slug
      ?.split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ") ??
    "sua clínica";
  return { kind: staffCode ? "equipe" : "cliente", slug, code, professional };
}
