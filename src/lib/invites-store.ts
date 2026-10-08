/**
 * Credenciais individuais de cada clínica. Ficam no aparelho enquanto não há banco:
 * cada clínica tem a sua lista (`estetboost:convites:<clinicId>`), e a cliente que usa o código
 * é filiada à clínica dona dele.
 */
export type InviteRec = {
  codigo: string;
  nome: string;
  celular: string;
  criadaEm: string;
  expiraEm: string;
  link: string;
  usadaEm?: string;
  revogada?: boolean;
};

export type InviteState = "pendente" | "usada" | "expirada" | "revogada";

const PREFIX = "estetboost:convites:";
const storageKey = (clinicId: string) => `${PREFIX}${clinicId}`;

export function readInvites(clinicId: string): InviteRec[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(storageKey(clinicId)) ?? "null");
    return Array.isArray(list) ? (list as InviteRec[]) : [];
  } catch {
    return [];
  }
}

export function writeInvites(clinicId: string, list: InviteRec[]) {
  try {
    window.localStorage.setItem(storageKey(clinicId), JSON.stringify(list));
  } catch {
    /* sem armazenamento */
  }
}

export const stateOf = (invite: InviteRec): InviteState =>
  invite.usadaEm
    ? "usada"
    : invite.revogada
      ? "revogada"
      : Date.now() > new Date(invite.expiraEm).getTime()
        ? "expirada"
        : "pendente";

/** Procura o código em todas as clínicas do aparelho. */
export function findInvite(code: string): { clinicId: string; invite: InviteRec } | null {
  const wanted = code.trim().toUpperCase();
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(PREFIX)) continue;
      const clinicId = key.slice(PREFIX.length);
      const invite = readInvites(clinicId).find((item) => item.codigo === wanted);
      if (invite) return { clinicId, invite };
    }
  } catch {
    /* sem armazenamento */
  }
  return null;
}

export function markInviteUsed(clinicId: string, code: string) {
  writeInvites(
    clinicId,
    readInvites(clinicId).map((item) =>
      item.codigo === code ? { ...item, usadaEm: new Date().toISOString() } : item,
    ),
  );
}
