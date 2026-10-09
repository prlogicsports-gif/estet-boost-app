import type { ActivityRec } from "@/lib/models";
import { supabase } from "@/lib/supabase";

/**
 * Anota no histórico da clínica o que uma cliente ou a esteticista fez. Quem escreve é a função do banco
 * (`log_activity`): ela decide o papel e o autor, e a cliente só registra o que ela mesma faz.
 */
export function logActivity(entry: Omit<ActivityRec, "id" | "at">) {
  void supabase
    .rpc("log_activity", {
      p_kind: entry.kind,
      p_client_id: entry.clientId ?? null,
      p_text: entry.text,
      p_sensitive: entry.kind === "pagamento",
    })
    .then(() => {});
}
