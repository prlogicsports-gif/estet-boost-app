import type { Client } from "@/components/eb/client-card";
import {
  appointments as mockAppointments,
  clients as mockClients,
  ledger as mockLedger,
  type LedgerEntry,
} from "@/data/gestor-mock";
import { addDays, instantOf, shiftSeedDate, todayISO } from "@/lib/dates";
import { createStore } from "@/lib/db";
import type {
  AnamnesisRec,
  AppointmentRec,
  BillRec,
  BlockRec,
  CareRec,
  ClinicRec,
  HoursRec,
  NotificationPrefs,
  NotificationRec,
  ProcedureRec,
  SessionRec,
  StockRec,
} from "@/lib/models";

/**
 * Coleções do app, com dados de exemplo que acompanham o dia de hoje. Tudo vive no
 * aparelho por enquanto; os serviços em `src/services` são o único lugar que grava.
 */
export type ClientRec = Client & {
  email?: string | undefined;
  createdAt: string;
  /** Clínica a que a cliente está filiada. Sem valor, é a clínica de demonstração. */
  clinicId?: string | undefined;
  /** Nascimento ISO; a idade é calculada a partir dele. */
  birth?: string | undefined;
  document?: string | undefined;
  address?: string | undefined;
  /** Autorização de uso interno das fotografias. */
  imageConsent?: boolean | undefined;
};

/** Clínica de demonstração (a da Fernanda) e dados que não têm clínica própria pertencem a ela. */
export const DEMO_CLINIC = "clinica-fernanda";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString();
const daysFromToday = (days: number) => addDays(todayISO(), days);

function seedClients(): ClientRec[] {
  const base: ClientRec[] = mockClients.map((client) => ({
    ...client,
    clinicId: DEMO_CLINIC,
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
      clinicId: DEMO_CLINIC,
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
      clinicId: DEMO_CLINIC,
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

const slugOfName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function seedClinics(): ClinicRec[] {
  return [
    {
      id: DEMO_CLINIC,
      slug: "fernanda-costa",
      name: "Estúdio Fernanda Costa",
      owner: "Fernanda Costa",
      email: "fernanda@estudio.com.br",
      phone: "(11) 98800-1234",
      city: "São Paulo, SP",
      size: "autonoma",
      createdAt: instantOf(daysFromToday(-200), "10:00"),
    },
  ];
}

function seedStock(): StockRec[] {
  const item = (
    id: string,
    name: string,
    category: string,
    quantity: number,
    unit: string,
    min: number,
    expiryDays: number,
    batch: string,
    cost: number,
    supplier: string,
  ): StockRec => ({
    id,
    name,
    category,
    quantity,
    unit,
    min,
    expiry: daysFromToday(expiryDays),
    batch,
    cost,
    supplier,
  });
  return [
    item(
      "s-acido-mandelico",
      "Ácido mandélico 5%",
      "Ativo",
      2,
      "fr",
      3,
      150,
      "A-2291",
      78,
      "Dermaline",
    ),
    item("s-argila-verde", "Argila verde", "Máscara", 6, "pt", 2, 48, "AG-118", 24, "Dermaline"),
    item(
      "s-serum-vitamina-c",
      "Sérum vitamina C",
      "Ativo",
      4,
      "fr",
      2,
      210,
      "VC-077",
      92,
      "Dermaline",
    ),
    item(
      "s-protetor-fps50",
      "Protetor solar FPS 50",
      "Cosmético",
      8,
      "un",
      3,
      330,
      "PS-310",
      38,
      "Cosmed",
    ),
    item("s-gaze", "Gaze estéril", "Descartável", 120, "un", 50, 600, "GZ-904", 0.4, "MedPharma"),
    item(
      "s-peeling-lactico",
      "Peeling ácido lático",
      "Ativo",
      1,
      "fr",
      2,
      9,
      "PL-042",
      110,
      "Dermaline",
    ),
  ];
}

function seedProcedures(): ProcedureRec[] {
  return [
    { id: "p1", name: "Limpeza de pele profunda", price: 180, duration: 60, returnDays: 14 },
    { id: "p2", name: "Peeling suave", price: 160, duration: 60, returnDays: 21 },
    { id: "p3", name: "Hidratação facial", price: 150, duration: 60, returnDays: 14 },
    { id: "p4", name: "Drenagem facial", price: 180, duration: 60, returnDays: 7 },
    { id: "p5", name: "Avaliação inicial", price: 120, duration: 45, returnDays: 7 },
    { id: "p6", name: "Microagulhamento", price: 260, duration: 75, returnDays: 30 },
  ];
}

/** Perguntas da anamnese: a clínica pode editar o modelo em Configurações. */
export const DEFAULT_QUESTIONS = [
  { id: "queixa", label: "Queixa principal" },
  { id: "objetivo", label: "Objetivo com o tratamento" },
  { id: "saude", label: "Saúde e doenças crônicas" },
  { id: "medicamentos", label: "Medicamentos em uso" },
  { id: "alergias", label: "Alergias" },
  { id: "rotina", label: "Rotina de cuidados em casa" },
  { id: "anteriores", label: "Procedimentos anteriores" },
];

export type Settings = {
  questions: { id: string; label: string }[];
  consentText: string;
};

export const DEFAULT_SETTINGS: Settings = {
  questions: DEFAULT_QUESTIONS,
  consentText:
    "Autorizo o registro e o uso interno de fotografias do meu rosto para acompanhar a evolução do tratamento. Posso revogar esta autorização a qualquer momento.",
};

function seedAnamnesis(): AnamnesisRec[] {
  return [
    {
      clientId: "c1",
      consent: true,
      updatedAt: instantOf(daysFromToday(-98), "10:00"),
      answers: {
        queixa: "Oleosidade e cravos na zona T",
        objetivo: "Reduzir oleosidade e cravos na zona T",
        saude: "Sem doenças crônicas relatadas",
        medicamentos: "Nenhum de uso contínuo",
        alergias: "Ácido salicílico",
        rotina: "Sabonete facial 2x/dia, protetor solar irregular",
        anteriores: "Nenhum",
      },
    },
  ];
}

function seedHours(): HoursRec {
  const weekday = { open: true, start: "09:00", end: "19:00" };
  return {
    slot: 30,
    days: {
      "0": { open: false, start: "09:00", end: "13:00" },
      "1": weekday,
      "2": weekday,
      "3": weekday,
      "4": weekday,
      "5": weekday,
      "6": { open: true, start: "09:00", end: "13:00" },
    },
  };
}

export const clinicsDb = createStore<ClinicRec[]>("eb:v1:clinicas", seedClinics);
export const clientsDb = createStore<ClientRec[]>("eb:v1:clientes", seedClients);
export const appointmentsDb = createStore<AppointmentRec[]>("eb:v1:atendimentos", seedAppointments);
export const notificationsDb = createStore<NotificationRec[]>(
  "eb:v1:notificacoes",
  seedNotifications,
);
export const billsDb = createStore<BillRec[]>("eb:v1:contas", seedBills);
export const ledgerDb = createStore<LedgerEntry[]>("eb:v1:caixa", () =>
  mockLedger.map((entry) => {
    const owner = mockClients.find((client) => client.name === entry.label);
    return {
      ...entry,
      date: shiftSeedDate(entry.date),
      ...(entry.due ? { due: shiftSeedDate(entry.due) } : {}),
      ...(owner && entry.kind === "receber" ? { clientId: owner.id } : {}),
    };
  }),
);
export const stockDb = createStore<StockRec[]>("eb:v1:estoque-v2", seedStock);
export const careDb = createStore<CareRec[]>("eb:v1:cuidados", seedCare);
export const proceduresDb = createStore<ProcedureRec[]>("eb:v1:procedimentos", seedProcedures);
export const anamnesisDb = createStore<AnamnesisRec[]>("eb:v1:anamneses", seedAnamnesis);
export const sessionsDb = createStore<SessionRec[]>("eb:v1:sessoes", () => []);
export const blocksDb = createStore<BlockRec[]>("eb:v1:bloqueios", () => [
  { id: "bl1", date: daysFromToday(3), start: "10:30", end: "12:00", reason: "Bloqueio pessoal" },
]);
export const hoursDb = createStore<HoursRec>("eb:v1:horarios", seedHours);
export const settingsDb = createStore<Settings>("eb:v1:configuracoes", () => DEFAULT_SETTINGS);
export const prefsDb = createStore<Record<string, NotificationPrefs>>("eb:v1:preferencias", () => ({
  gestor: { ...defaultPrefs },
  cliente: { ...defaultPrefs },
}));

/** Volta todos os dados ao exemplo inicial. */
export function resetDemoData() {
  [
    clinicsDb,
    clientsDb,
    appointmentsDb,
    notificationsDb,
    billsDb,
    ledgerDb,
    stockDb,
    careDb,
    proceduresDb,
    anamnesisDb,
    sessionsDb,
    blocksDb,
    hoursDb,
    settingsDb,
    prefsDb,
  ].forEach((store) => store.reset());
}
