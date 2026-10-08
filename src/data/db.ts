import type { Client } from "@/components/eb/client-card";
import type { StockEntry } from "@/components/eb/stock-item";
import {
  appointments as mockAppointments,
  clients as mockClients,
  ledger as mockLedger,
  stock as mockStock,
  type LedgerEntry,
} from "@/data/gestor-mock";
import { addDays, instantOf, shiftSeedDate, todayISO } from "@/lib/dates";
import { createStore } from "@/lib/db";
import type {
  AppointmentRec,
  BillRec,
  CareRec,
  NotificationPrefs,
  NotificationRec,
} from "@/lib/models";

/**
 * Coleções do app, com dados de exemplo que acompanham o dia de hoje. Tudo vive no
 * aparelho por enquanto; os serviços em `src/services` são o único lugar que grava.
 */
export type ClientRec = Client & {
  email?: string | undefined;
  createdAt: string;
  /** Autorização de uso interno das fotografias. */ imageConsent?: boolean | undefined;
};

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString();
const daysFromToday = (days: number) => addDays(todayISO(), days);

function seedClients(): ClientRec[] {
  const base: ClientRec[] = mockClients.map((client) => ({
    ...client,
    createdAt: instantOf(daysFromToday(-90), "10:00"),
  }));
  base.push(
    {
      id: "c6",
      name: "Ana Lúcia",
      initials: "AL",
      mainProcedure: "Limpeza de pele",
      lastVisit: "há 14 dias",
      nextReturn: "amanhã",
      status: "confirmed",
      age: 45,
      phone: "(11) 97711-3040",
      createdAt: instantOf(daysFromToday(-60), "10:00"),
    },
    {
      id: "c7",
      name: "Paula Andrade",
      initials: "PA",
      mainProcedure: "Primeira consulta solicitada",
      lastVisit: "—",
      nextReturn: "—",
      status: "pending",
      alert: "Aguardando aprovação",
      age: 31,
      phone: "(11) 96600-2288",
      createdAt: instantOf(daysFromToday(-1), "10:00"),
    },
  );
  return base;
}

function seedAppointments(): AppointmentRec[] {
  const today = todayISO();
  const fromMock: AppointmentRec[] = mockAppointments.map((item) => ({
    id: item.id,
    clientId: item.clientId,
    client: item.client,
    initials: item.initials,
    procedure: item.procedure,
    date: today,
    time: item.time,
    duration: 60,
    price: Number(item.price.replace(/\D/g, "")),
    payment: "Pix",
    status: item.status === "confirmed" ? "confirmed" : "pending",
    kind: item.kind,
    session: item.session,
    sessionsTotal: item.sessionsTotal,
    origin: "gestor",
    alert: item.alert,
    createdAt: instantOf(daysFromToday(-7), "09:00"),
  }));
  const extra = (
    id: string,
    clientId: string,
    client: string,
    initials: string,
    procedure: string,
    offset: number,
    time: string,
    price: number,
    status: AppointmentRec["status"],
    more: Partial<AppointmentRec> = {},
  ): AppointmentRec => ({
    id,
    clientId,
    client,
    initials,
    procedure,
    date: daysFromToday(offset),
    time,
    duration: 60,
    price,
    payment: "Pix",
    status,
    kind: "retorno",
    origin: "gestor",
    createdAt: instantOf(daysFromToday(-3), "09:00"),
    ...more,
  });
  return [
    ...fromMock,
    extra("ap5", "c6", "Ana Lúcia", "AL", "Limpeza de pele profunda", 1, "09:00", 180, "confirmed"),
    extra("ap6", "c5", "Renata Dias", "RD", "Hidratação facial", 1, "11:00", 150, "confirmed"),
    extra(
      "ap7",
      "c7",
      "Paula Andrade",
      "PA",
      "Limpeza de pele profunda",
      2,
      "15:00",
      180,
      "pending",
      { origin: "cliente", request: true, kind: "primeira", createdAt: minutesAgo(5) },
    ),
    extra(
      "ap8",
      "c1",
      "Mariana Silva",
      "MS",
      "Limpeza de pele profunda",
      14,
      "14:00",
      180,
      "confirmed",
      { session: 3, sessionsTotal: 4 },
    ),
    extra(
      "ap9",
      "c1",
      "Mariana Silva",
      "MS",
      "Limpeza de pele profunda",
      28,
      "14:00",
      180,
      "pending",
      { session: 4, sessionsTotal: 4 },
    ),
    extra("ap10", "c3", "Camila Ferraz", "CF", "Avaliação inicial", 11, "16:00", 120, "cancelled", {
      kind: "primeira",
    }),
  ];
}

function seedNotifications(): NotificationRec[] {
  return [
    {
      id: "n-seed-1",
      audience: "gestor",
      kind: "request",
      title: "Nova solicitação de horário",
      body: `Paula Andrade · ${new Date(`${daysFromToday(2)}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" })}, 15h`,
      createdAt: minutesAgo(5),
      read: false,
      href: "/agenda",
    },
    {
      id: "n-seed-2",
      audience: "gestor",
      kind: "confirmed",
      title: "Bruna confirmou presença",
      body: "Drenagem facial · hoje 19:15",
      createdAt: minutesAgo(60 * 20),
      read: true,
      href: "/hoje",
    },
    {
      id: "n-seed-3",
      audience: "cliente",
      clientId: "c1",
      kind: "recommendation",
      title: "Nova recomendação de Fernanda",
      body: "Protetor solar todas as manhãs",
      createdAt: minutesAgo(60 * 48),
      read: false,
      href: "/cliente/evolucao",
    },
    {
      id: "n-seed-4",
      audience: "cliente",
      clientId: "c1",
      kind: "reschedule",
      title: "Horário alterado",
      body: "Seu retorno mudou de 15:00 para 14:00",
      createdAt: minutesAgo(60 * 24 * 5),
      read: true,
      href: "/cliente/agenda",
    },
  ];
}

function seedBills(): BillRec[] {
  return [
    {
      id: "b1",
      name: "Aluguel da sala",
      value: 900,
      due: daysFromToday(4),
      recurrence: "Mensal",
      paid: false,
    },
    {
      id: "b2",
      name: "Energia",
      value: 148,
      due: daysFromToday(11),
      recurrence: "Mensal",
      paid: false,
    },
    {
      id: "b3",
      name: "Fornecedor Dermaline",
      value: 320,
      due: daysFromToday(-4),
      recurrence: "Avulsa",
      paid: false,
    },
    {
      id: "b4",
      name: "Internet",
      value: 99,
      due: daysFromToday(1),
      recurrence: "Mensal",
      paid: true,
    },
  ];
}

function seedCare(): CareRec[] {
  const created = minutesAgo(60 * 48);
  const until = daysFromToday(30);
  return [
    {
      id: "care-1",
      clientId: "c1",
      text: "Protetor solar todas as manhãs. FPS 50, reaplicar após 4 horas de exposição.",
      createdAt: created,
      reminderTime: "08:00",
      until,
    },
    {
      id: "care-2",
      clientId: "c1",
      text: "Evitar esfoliação por 5 dias. A pele está em recuperação após a extração.",
      createdAt: created,
    },
    {
      id: "care-3",
      clientId: "c1",
      text: "Sabonete facial suave à noite. Sem ativos ácidos até a próxima sessão.",
      createdAt: created,
      reminderTime: "21:00",
      until,
    },
  ];
}

export const defaultPrefs: NotificationPrefs = {
  appointments: true,
  payments: true,
  stock: true,
  recommendations: true,
  push: true,
  whatsapp: false,
};

export const clientsDb = createStore<ClientRec[]>("eb:v1:clientes", seedClients);
export const appointmentsDb = createStore<AppointmentRec[]>("eb:v1:atendimentos", seedAppointments);
export const notificationsDb = createStore<NotificationRec[]>(
  "eb:v1:notificacoes",
  seedNotifications,
);
export const billsDb = createStore<BillRec[]>("eb:v1:contas", seedBills);
export const ledgerDb = createStore<LedgerEntry[]>("eb:v1:caixa", () =>
  mockLedger.map((entry) => ({
    ...entry,
    date: shiftSeedDate(entry.date),
    ...(entry.due ? { due: shiftSeedDate(entry.due) } : {}),
  })),
);
export const stockDb = createStore<StockEntry[]>("eb:v1:estoque", () =>
  mockStock.map((item) => ({ ...item })),
);
export const careDb = createStore<CareRec[]>("eb:v1:cuidados", seedCare);
export const prefsDb = createStore<Record<string, NotificationPrefs>>("eb:v1:preferencias", () => ({
  gestor: { ...defaultPrefs },
  cliente: { ...defaultPrefs },
}));

/** Volta todos os dados ao exemplo inicial. */
export function resetDemoData() {
  [clientsDb, appointmentsDb, notificationsDb, billsDb, ledgerDb, stockDb, careDb, prefsDb].forEach(
    (store) => store.reset(),
  );
}
