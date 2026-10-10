import type { NotificationKind } from "@/components/eb/notification-center";
import type { Audience, NotificationPrefs } from "@/lib/models";

/** Nome do tipo de aviso (mesma regra do título do push, em supabase/functions/send-push). */
export function kindLabel(kind: NotificationKind | string, audience: Audience): string {
  const client = audience === "cliente";
  if (kind === "bill" || kind === "payment") return client ? "Pagamento" : "Financeiro";
  if (kind === "stock") return "Estoque";
  if (kind === "recommendation") return client ? "Cuidados" : "Clientes";
  if (kind === "followup") return client ? "Seu cuidado" : "Clientes";
  return "Agenda";
}

/** Categoria de preferência de cada tipo (Configurações → Avisos). */
export function prefKeyOf(kind: NotificationKind | string): keyof NotificationPrefs {
  if (kind === "bill" || kind === "payment") return "payments";
  if (kind === "stock") return "stock";
  if (kind === "recommendation") return "recommendations";
  return "appointments";
}
