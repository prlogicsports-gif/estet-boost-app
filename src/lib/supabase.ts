import { createClient } from "@supabase/supabase-js";

/**
 * Único lugar que cria o cliente do Supabase. Usa só a chave PÚBLICA (publishable/anon):
 * quem protege os dados são as políticas RLS do banco. A chave secreta (service_role) nunca
 * entra aqui nem em qualquer variável VITE_*.
 */
const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;

export const supabaseConfigured = Boolean(url && key);

export const supabase = createClient(url ?? "http://localhost:54321", key ?? "sem-chave", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
