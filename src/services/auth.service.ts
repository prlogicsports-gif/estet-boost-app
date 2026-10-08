import { demoAccounts } from "@/data/mock-auth";
import type { AuthResult, Invite, Session, SignupData } from "@/lib/auth.types";
import { sessionStore } from "@/lib/session";
import { createClient } from "@/services/clients.service";

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
  async signUp(data: Pick<SignupData, "name" | "email">): Promise<AuthResult> {
    await wait();
    return open({ role: "gestor", name: data.name, email: data.email.trim().toLowerCase() });
  },
  /** Cadastro por convite: quem entra por convite é cliente. */
  async acceptInvite(
    data: { name: string; email: string; phone?: string },
    invite: Invite,
  ): Promise<AuthResult> {
    await wait();
    // Quem entra por convite entra na carteira da esteticista que convidou.
    const client = createClient({
      name: data.name,
      email: data.email,
      ...(data.phone ? { phone: data.phone } : {}),
      procedure: invite.professional ? `Convidada por ${invite.professional}` : undefined,
    });
    return open({
      role: "cliente",
      name: data.name,
      email: data.email.trim().toLowerCase(),
      clientId: client.id,
    });
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
