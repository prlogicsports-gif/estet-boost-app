import { clientsDb, type ClientRec } from "@/data/db";
import { initialsOf } from "@/data/mock-auth";
import { notify } from "@/services/notify";

type NewClient = {
  name: string;
  phone?: string | undefined;
  email?: string | undefined;
  procedure?: string | undefined;
};

/** Cadastra uma cliente na carteira (pela esteticista ou quando ela aceita o convite). */
export function createClient(input: NewClient): ClientRec {
  const email = input.email?.trim().toLowerCase();
  const existing = clientsDb
    .get()
    .find(
      (client) =>
        (email && client.email === email) ||
        client.name.toLowerCase() === input.name.trim().toLowerCase(),
    );
  if (existing) return existing;
  const rec: ClientRec = {
    id: `c${Date.now()}`,
    name: input.name.trim(),
    initials: initialsOf(input.name),
    mainProcedure: input.procedure?.trim() || "Sem procedimento definido",
    lastVisit: "—",
    nextReturn: "—",
    status: "neutral",
    age: 0,
    phone: input.phone?.trim() ?? "",
    email,
    createdAt: new Date().toISOString(),
  };
  clientsDb.set((list) => [...list, rec]);
  notify({
    audience: "gestor",
    kind: "followup",
    title: "Nova cliente na carteira",
    body: `${rec.name} se cadastrou`,
    href: `/clientes/${rec.id}`,
  });
  return rec;
}

export const findClient = (id: string | undefined) =>
  clientsDb.get().find((client) => client.id === id);
