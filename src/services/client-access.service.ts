import { clientsDb } from "@/data/db";
import { flushAll } from "@/lib/remote-store";
import { supabase } from "@/lib/supabase";

const REASONS: Record<string, string> = {
  email_em_uso:
    "Esse e-mail já tem conta no EstetBoost. Peça para a cliente entrar com ele ou use outro e-mail.",
  ja_tem_acesso: "Esta cliente já tem acesso ao app.",
  sem_acesso: "Esta cliente ainda não tem acesso ao app.",
  senha_curta: "A senha precisa ter de 8 a 72 caracteres.",
  email_invalido: "Confira o e-mail da cliente.",
  limite: "Muitos acessos criados nesta hora. Tente de novo mais tarde.",
  sem_permissao: "Você não tem permissão para criar acessos.",
  sem_login: "Sua sessão expirou. Entre de novo.",
  nao_encontrada: "A ficha ainda não chegou ao servidor. Aguarde alguns segundos e tente de novo.",
  dados_invalidos: "Dados inválidos. Confira o e-mail e a senha.",
};

export type AccessResult = { ok: true } | { ok: false; message: string };

/**
 * Cria (ou redefine a senha d)o acesso da cliente ao app. Precisa de internet: antes de chamar o servidor,
 * envia a fila de alterações para a ficha já existir lá. A senha só viaja até o servidor; não fica guardada aqui.
 */
export async function createClientAccess(input: {
  clientId: string;
  email: string;
  password: string;
  mode?: "create" | "reset";
}): Promise<AccessResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    return { ok: false, message: "Conecte-se à internet para criar o acesso da cliente." };
  try {
    await flushAll();
    const { data, error } = await supabase.functions.invoke("create-client-account", {
      body: {
        client_id: input.clientId,
        email: input.email.trim().toLowerCase(),
        password: input.password,
        mode: input.mode ?? "create",
      },
    });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      return {
        ok: false,
        message:
          status === 404
            ? "A função de criar acesso ainda não foi publicada no Supabase (create-client-account)."
            : "Não foi possível criar o acesso agora. Confira a internet e tente de novo.",
      };
    }
    const result = data as { ok?: boolean; reason?: string } | null;
    if (!result?.ok)
      return {
        ok: false,
        message: REASONS[result?.reason ?? ""] ?? "Não foi possível criar o acesso agora.",
      };
    await clientsDb.reload();
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Não foi possível criar o acesso agora. Confira a internet e tente de novo.",
    };
  }
}
