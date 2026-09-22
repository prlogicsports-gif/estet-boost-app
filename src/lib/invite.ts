import type { Invite } from "./auth.types";

export function readInvite(search: string): Invite | null {
  const query = new URLSearchParams(search);
  const slug = query.get("p");
  const code = query.get("convite");
  if (!slug && !code) return null;
  const professional = query.get("nome") ?? slug?.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") ?? "sua esteticista";
  return { slug, code, professional };
}