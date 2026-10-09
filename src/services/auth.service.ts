import type { AuthResult, Invite, SignupData, StudioSize } from "@/lib/auth.types";
import { sessionStore } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/**
 * Login real (Supabase Auth). O cadastro tem duas partes: criar o acesso (e-mail e senha, confirmado por
 * e-mail) e completar o perfil no servidor (criar a clínica ou aceitar a credencial). Como a confirmação por
 * e-mail abre o app de novo, o que falta fazer fica guardado em `eb.pending` (sem a senha) até o perfil existir.
 */
const PENDING_KEY = "eb.pending";

export type Pending =
  | {
      type: "gestor";
      name: string;
      phone: string;
      studio: string;
      city: string;
      document: string;
      size: StudioSize;
    }
  | { type: "cliente"; name: string; phone: string; code: string | null; slug: string | null }
  | { type: "equipe"; name: string; code: string };

export const pendingStore = {
  get(): Pending | null {
    try {
      return JSON.parse(window.localStorage.getItem(PENDING_KEY) ?? "null") as Pending | null;
    } catch {
      return null;
    }
  },
  set(value: Pending) {
    try {
      window.localStorage.setItem(PENDING_KEY, JSON.stringify(value));
    } catch {
      /* ignorado */
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignorado */
    }
  },
};

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);

function friendly(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (text.includes("not confirmed"))
    return "Confirme seu e-mail pelo link que enviamos e depois entre.";
  if (text.includes("rate limit") || text.includes("too many"))
    return "Muitas tentativas. Espere alguns minutos e tente de novo.";
  if (text.includes("password")) return "A senha precisa ter ao menos 8 caracteres.";
  if (text.includes("valid email")) return "Esse e-mail não parece válido.";
  return "Não foi possível concluir. Tente de novo em instantes.";
}

const REASONS: Record<string, string> = {
  invalido: "Credencial inválida, expirada ou já usada. Peça uma nova.",
  bloqueado: "Muitas tentativas erradas. Aguarde uma hora e tente de novo.",
  email_nao_confirmado: "Confirme seu e-mail primeiro.",
  dados_incompletos: "Preencha o nome e o nome do estúdio.",
  sem_permissao: "Sem permissão para essa ação.",
};
export const reasonText = (reason: string | undefined) =>
  REASONS[reason ?? ""] ?? "Não foi possível concluir. Tente de novo.";

async function signUp(email: string, password: string, pending: Pending): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { emailRedirectTo: `${origin()}/` },
  });
  if (error) return { ok: false, message: friendly(error.message) };
  // Com a confirmação de e-mail ligada, um e-mail já cadastrado volta sem identidades.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { ok: false, message: "Esse e-mail já tem conta. Entre ou recupere a senha." };
  }
  pendingStore.set(pending);
  if (data.session) {
    const done = await authService.finishPending();
    return done.ok ? { ok: true } : done;
  }
  return { ok: true, needsEmail: true };
}

export const authService = {
  async signIn(email: string, password: string): Promise<AuthResult> {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) return { ok: false, message: friendly(error.message) };
    return { ok: true };
  },

  /** Cadastro pelo app: quem cria conta aqui é a gestora e abre a própria clínica. */
  signUpGestora(data: SignupData): Promise<AuthResult> {
    return signUp(data.email, data.password, {
      type: "gestor",
      name: data.name.trim(),
      phone: data.phone.trim(),
      studio: data.studio.trim(),
      city: data.city.trim(),
      document: data.document.trim(),
      size: data.size,
    });
  },

  /** Cadastro de cliente pelo link da clínica ou por credencial. */
  signUpCliente(
    data: { name: string; email: string; password: string; phone: string },
    invite: Invite,
  ): Promise<AuthResult> {
    return signUp(data.email, data.password, {
      type: "cliente",
      name: data.name.trim(),
      phone: data.phone.trim(),
      code: invite.code,
      slug: invite.slug,
    });
  },

  /** Cadastro da funcionária pela credencial de equipe. */
  signUpEquipe(
    data: { name: string; email: string; password: string },
    invite: Invite,
  ): Promise<AuthResult> {
    return signUp(data.email, data.password, {
      type: "equipe",
      name: data.name.trim(),
      code: invite.code ?? "",
    });
  },

  /** Completa o que ficou pendente (criar a clínica ou aceitar a credencial). Seguro para repetir. */
  async finishPending(): Promise<AuthResult> {
    const pending = pendingStore.get();
    if (!pending) return { ok: false, message: "Nada a concluir." };
    const call =
      pending.type === "gestor"
        ? supabase.rpc("create_clinic", {
            p_name: pending.name,
            p_phone: pending.phone,
            p_studio: pending.studio,
            p_city: pending.city,
            p_document: pending.document,
            p_size: pending.size,
          })
        : pending.type === "cliente"
          ? supabase.rpc("accept_invite", {
              p_code: pending.code ?? "",
              p_slug: pending.slug ?? "",
              p_name: pending.name,
              p_phone: pending.phone,
            })
          : supabase.rpc("accept_staff_invite", { p_code: pending.code, p_name: pending.name });
    const { data, error } = await call;
    if (error)
      return { ok: false, message: "Não foi possível concluir o cadastro. Tente de novo." };
    const result = data as { ok: boolean; reason?: string };
    if (!result?.ok) {
      pendingStore.clear();
      return { ok: false, message: reasonText(result?.reason) };
    }
    pendingStore.clear();
    await sessionStore.refresh();
    return { ok: true };
  },

  async requestPasswordReset(email: string): Promise<AuthResult> {
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${origin()}/redefinir-senha`,
    });
    return { ok: true }; // resposta igual exista ou não o e-mail
  },

  async updatePassword(password: string): Promise<AuthResult> {
    const { error } = await supabase.auth.updateUser({ password });
    return error ? { ok: false, message: friendly(error.message) } : { ok: true };
  },

  async signOut() {
    await supabase.auth.signOut();
  },
};
