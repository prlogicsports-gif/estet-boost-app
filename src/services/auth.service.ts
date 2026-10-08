import { demoAccounts } from "@/data/mock-auth";
import type { AuthResult, Invite, Session, SignupData } from "@/lib/auth.types";
import { sessionStore } from "@/lib/session";
import { findInvite, markInviteUsed, stateOf } from "@/lib/invites-store";
import { clinicBySlug, clinicById, createClinic } from "@/services/clinic.service";
import { createClient } from "@/services/clients.service";
import { events } from "@/services/notification-events";
import { notify } from "@/services/notify";

const wait = () => new Promise((resolve) => setTimeout(resolve, 350));

const ACCOUNTS_KEY = "eb.accounts";

function savedAccounts(): Session[] {
  try {
    return JSON.parse(window.localStorage.getItem(ACCOUNTS_KEY) ?? "[]") as Session[];
  } catch {
    return [];
  }
}

function saveAccount(account: Session) {
  try {
    const others = savedAccounts().filter((item) => item.email !== account.email);
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...others, account]));
  } catch {
    /* sem armazenamento */
  }
}

function open(session: Session): AuthResult {
  saveAccount(session);
  sessionStore.set(session);
  return { ok: true, session };
}

/** Substituível por Supabase: o perfil (gestor ou cliente) vem da conta, não da tela. */
export const authService = {
  async signIn(email: string, _password: string): Promise<AuthResult> {
    await wait();
    const key = email.trim().toLowerCase();
    const found = [...demoAccounts, ...savedAccounts()].find(
      (item) => item.email.toLowerCase() === key,
    );
    if (!found) {
      return { ok: false, message: "Não encontramos esse e-mail. Confira ou crie sua conta." };
    }
    sessionStore.set(found);
    return { ok: true, session: found };
  },
  async requestPasswordReset(_email: string) {
    await wait();
    return { ok: true as const };
  },
  /** Cadastro pelo app: quem cria conta aqui é gestor (esteticista). */
  async signUp(data: SignupData): Promise<AuthResult> {
    await wait();
    const email = data.email.trim().toLowerCase();
    if ([...demoAccounts, ...savedAccounts()].some((item) => item.email.toLowerCase() === email)) {
      return { ok: false, message: "Esse e-mail já tem conta. Entre ou use outro e-mail." };
    }
    // Cada esteticista abre a própria clínica: é ela que dá o link e as credenciais de cadastro.
    const clinic = createClinic(data);
    return open({ role: "gestor", name: data.name.trim(), email, clinicId: clinic.id });
  },
  /** Cadastro por convite: quem entra por convite é cliente. */
  async acceptInvite(
    data: { name: string; email: string; phone?: string },
    invite: Invite,
  ): Promise<AuthResult> {
    await wait();
    // A credencial (ou o link) diz a que clínica a cliente é filiada.
    let clinicId: string | undefined;
    if (invite.code) {
      const found = findInvite(invite.code);
      if (!found)
        return {
          ok: false,
          message: "Não encontramos essa credencial. Peça uma nova à sua esteticista.",
        };
      const state = stateOf(found.invite);
      if (state !== "pendente")
        return {
          ok: false,
          message:
            state === "usada"
              ? "Essa credencial já foi usada."
              : state === "expirada"
                ? "Essa credencial expirou. Peça uma nova."
                : "Essa credencial foi cancelada.",
        };
      clinicId = found.clinicId;
    } else {
      clinicId = clinicBySlug(invite.slug)?.id;
      if (!clinicId)
        return {
          ok: false,
          message: "Não encontramos a clínica deste link. Peça um novo link à sua esteticista.",
        };
    }
    const email = data.email.trim().toLowerCase();
    const client = createClient({
      name: data.name,
      email,
      clinicId,
      via: "link",
      ...(data.phone ? { phone: data.phone } : {}),
    });
    if (invite.code) markInviteUsed(clinicId, invite.code);
    const clinic = clinicById(clinicId);
    if (clinic) notify(events.affiliated(client.id, clinic));
    return open({ role: "cliente", name: data.name.trim(), email, clientId: client.id, clinicId });
  },
  /** Acesso livre temporário: abre a área do perfil sem credencial, até o app ser ativado. */
  enterAs(role: Session["role"]): Session {
    const session = demoAccounts.find((item) => item.role === role) ?? demoAccounts[0]!;
    sessionStore.set(session);
    return session;
  },
  signOut() {
    sessionStore.clear();
  },
};
