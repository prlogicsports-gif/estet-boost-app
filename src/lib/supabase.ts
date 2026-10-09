/**
 * Ponto único de acesso ao Supabase para o app. O cliente em si é gerado pelo Lovable
 * (`src/integrations/supabase/client.ts`, não editar) e usa só a chave PÚBLICA: quem protege
 * os dados são as políticas RLS do banco. A chave secreta (service_role) nunca entra no navegador
 * e só é usada em funções de servidor (`client.server.ts`), que ignoram o RLS e por isso exigem
 * checagem de papel manual.
 */
export { supabase } from "@/integrations/supabase/client";
export const supabaseConfigured = true;
