import { logActivity } from "@/services/activity.service";
import { clientsDb, DEMO_CLINIC, type ClientRec } from "@/data/db";
import { initialsOf } from "@/data/mock-auth";
import { events } from "@/services/notification-events";
import { notify } from "@/services/notify";

export type NewClient = {
  name: string;
  phone?: string | undefined;
  email?: string | undefined;
  procedure?: string | undefined;
  clinicId?: string | undefined;
  birth?: string | undefined;
  document?: string | undefined;
  address?: string | undefined;
  goal?: string | undefined;
  allergies?: string | undefined;
  contra?: string | undefined;
  note?: string | undefined;
  via?: "link" | "cadastro";
};

const clean = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined && v !== ""),
  ) as Partial<T>;

/** Idade em anos a partir do nascimento ISO. */
export function ageOf(birth: string | undefined) {
  if (!birth) return 0;
  const born = new Date(`${birth}T12:00:00`);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  if (
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())
  )
    age -= 1;
  return Math.max(0, age);
}

/** Cadastra uma cliente na carteira de uma clínica (pela esteticista ou quando a cliente aceita o convite). */
export function createClient(input: NewClient): ClientRec {
  const email = input.email?.trim().toLowerCase();
  const clinicId = input.clinicId ?? DEMO_CLINIC;
  const existing = clientsDb
    .get()
    .find(
      (client) =>
        (client.clinicId ?? DEMO_CLINIC) === clinicId &&
        ((email && client.email === email) ||
          client.name.toLowerCase() === input.name.trim().toLowerCase()),
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
    age: ageOf(input.birth),
    phone: input.phone?.trim() ?? "",
    email,
    clinicId,
    createdAt: new Date().toISOString(),
    ...clean({
      birth: input.birth,
      document: input.document,
      address: input.address,
      goal: input.goal,
      allergies: input.allergies,
      contra: input.contra,
      note: input.note,
    }),
  };
  clientsDb.set((list) => [...list, rec]);
  notify(events.clientRegistered(rec, input.via ?? "cadastro"));
  logActivity({
    by: input.via === "link" ? "cliente" : "gestor",
    kind: "cadastro",
    clientId: rec.id,
    client: rec.name,
    text:
      input.via === "link"
        ? "Se cadastrou pelo link da clínica"
        : "Foi cadastrada pela esteticista",
  });
  return rec;
}

/** Atualiza os dados de uma cliente (a esteticista pelo prontuário, ou a própria cliente pelo perfil). */
export function updateClient(id: string, patch: Partial<Omit<ClientRec, "id" | "createdAt">>) {
  clientsDb.set((list) =>
    list.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, ...patch };
      if (patch.name) next.initials = initialsOf(patch.name);
      if (patch.birth !== undefined) next.age = ageOf(patch.birth || undefined);
      return next;
    }),
  );
}

export const findClient = (id: string | undefined) =>
  clientsDb.get().find((client) => client.id === id);
