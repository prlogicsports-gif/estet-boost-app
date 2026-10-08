import type { Appointment } from "@/components/eb/appointment-card";
import type { CalendarEvents } from "@/components/eb/calendar";
import type { Client } from "@/components/eb/client-card";
import type { TimelineEntry } from "@/components/eb/client-timeline";
import type { NotificationItem } from "@/components/eb/notification-center";
import type { StockEntry } from "@/components/eb/stock-item";
import type { StatusTone } from "@/components/eb/status-badge";

/** Dados de exemplo do app da esteticista, atrás da camada de serviço. */
export const pro = { name: "Fernanda Costa", initials: "FC", role: "Esteticista autônoma" };
export const todayLabel = "Terça, 1 de setembro de 2026";

export const appointments: Appointment[] = [
  {
    id: "a1",
    clientId: "c1",
    time: "14:00",
    client: "Mariana Silva",
    initials: "MS",
    procedure: "Limpeza de pele profunda",
    kind: "retorno",
    session: 2,
    sessionsTotal: 4,
    status: "confirmed",
    price: "R$ 180",
  },
  {
    id: "a2",
    clientId: "c2",
    time: "16:30",
    client: "Juliana Prado",
    initials: "JP",
    procedure: "Peeling suave",
    kind: "retorno",
    session: 1,
    sessionsTotal: 3,
    status: "pending",
    price: "R$ 160",
    alert: "Sem confirmação",
  },
  {
    id: "a3",
    clientId: "c3",
    time: "18:00",
    client: "Camila Ferraz",
    initials: "CF",
    procedure: "Avaliação inicial",
    kind: "primeira",
    status: "pending",
    price: "R$ 120",
    alert: "Sem anamnese",
  },
  {
    id: "a4",
    clientId: "c4",
    time: "19:15",
    client: "Bruna Antunes",
    initials: "BA",
    procedure: "Drenagem facial",
    kind: "retorno",
    session: 3,
    sessionsTotal: 6,
    status: "confirmed",
    price: "R$ 180",
  },
];

export const events: CalendarEvents = {
  "2026-09-01": [
    { time: "14:00", client: "Mariana Silva", status: "confirmed" },
    { time: "16:30", client: "Juliana Prado", status: "pending" },
    { time: "18:00", client: "Camila Ferraz", status: "pending" },
    { time: "19:15", client: "Bruna Antunes", status: "confirmed" },
  ],
  "2026-09-02": [
    { time: "09:00", client: "Ana Lúcia", status: "confirmed" },
    { time: "11:00", client: "Renata Dias", status: "confirmed" },
  ],
  "2026-09-03": [{ time: "15:00", client: "Solicitação · Paula", status: "pending" }],
  "2026-09-04": [{ time: "10:30", client: "Bloqueio pessoal", status: "neutral" }],
  "2026-09-08": [{ time: "14:00", client: "Mariana Silva", status: "confirmed" }],
  "2026-09-12": [{ time: "16:00", client: "Camila Ferraz", status: "cancelled" }],
};

export const clients: Client[] = [
  {
    id: "c1",
    name: "Mariana Silva",
    initials: "MS",
    mainProcedure: "Limpeza de pele · pacote 4 sessões",
    lastVisit: "há 28 dias",
    nextReturn: "12 set",
    status: "pending",
    alert: "Pagamento pendente",
    age: 34,
    phone: "(11) 98844-1027",
    goal: "Reduzir oleosidade e cravos na zona T",
    allergies: "Ácido salicílico",
    contra: "Gestante — evitar peelings profundos",
    session: "2 de 4",
    note: "Sensibilidade leve registrada na bochecha direita.",
  },
  {
    id: "c2",
    name: "Juliana Prado",
    initials: "JP",
    mainProcedure: "Peeling suave · pacote 3 sessões",
    lastVisit: "há 12 dias",
    nextReturn: "05 set",
    status: "confirmed",
    age: 41,
    phone: "(11) 99120-4432",
  },
  {
    id: "c3",
    name: "Camila Ferraz",
    initials: "CF",
    mainProcedure: "Avaliação inicial",
    lastVisit: "—",
    nextReturn: "hoje",
    status: "pending",
    alert: "Sem anamnese",
    age: 27,
    phone: "(11) 98801-7755",
  },
  {
    id: "c4",
    name: "Bruna Antunes",
    initials: "BA",
    mainProcedure: "Drenagem facial · pacote 6 sessões",
    lastVisit: "há 7 dias",
    nextReturn: "08 set",
    status: "confirmed",
    age: 38,
    phone: "(11) 97441-2210",
  },
  {
    id: "c5",
    name: "Renata Dias",
    initials: "RD",
    mainProcedure: "Hidratação facial",
    lastVisit: "há 96 dias",
    nextReturn: "—",
    status: "neutral",
    alert: "Sem atendimento recente",
    age: 52,
    phone: "(11) 98220-6631",
  },
];

export const timeline: TimelineEntry[] = [
  {
    id: "t1",
    date: "04 ago",
    procedure: "Limpeza de pele profunda",
    region: "Zona T e bochechas",
    product: "Ácido mandélico 5%",
    note: "Leve sensibilidade na bochecha direita ao final da sessão.",
    photos: 2,
    payment: "Pix · R$ 180",
    professional: "Fernanda",
  },
  {
    id: "t2",
    date: "07 jul",
    procedure: "Limpeza de pele profunda",
    region: "Zona T",
    product: "Ácido mandélico 5%",
    note: "Boa resposta, sem intercorrências.",
    photos: 2,
    payment: "Pix · R$ 180",
    professional: "Fernanda",
  },
  {
    id: "t3",
    date: "02 jun",
    procedure: "Avaliação inicial e anamnese",
    region: "Face completa",
    note: "Objetivo: reduzir oleosidade e cravos.",
    photos: 1,
    payment: "Cortesia",
    professional: "Fernanda",
  },
];

export const notifications: NotificationItem[] = [
  {
    id: "n1",
    kind: "request",
    title: "Nova solicitação de horário",
    body: "Paula Andrade · quinta, 15h",
    time: "agora",
    unread: true,
  },
  {
    id: "n2",
    kind: "stock",
    title: "Estoque baixo",
    body: "Ácido mandélico 5% · 2 frascos",
    time: "2h",
    unread: true,
  },
  {
    id: "n3",
    kind: "bill",
    title: "Conta vencendo",
    body: "Aluguel da sala · 05 set",
    time: "hoje",
    unread: true,
  },
  {
    id: "n4",
    kind: "confirmed",
    title: "Bruna confirmou presença",
    body: "Drenagem facial · hoje 19:15",
    time: "ontem",
  },
  {
    id: "n5",
    kind: "followup",
    title: "Cliente no período de retorno",
    body: "Renata Dias · 96 dias sem atendimento",
    time: "2 dias",
  },
];

export const stock: StockEntry[] = [
  {
    name: "Ácido mandélico 5%",
    quantity: 2,
    unit: "fr",
    min: 3,
    expiry: "03/2027",
    batch: "A-2291",
    cost: "R$ 78",
  },
  {
    name: "Argila verde",
    quantity: 6,
    unit: "pt",
    min: 2,
    expiry: "11/2026",
    batch: "AG-118",
    cost: "R$ 24",
  },
  {
    name: "Máscara calmante",
    quantity: 1,
    unit: "un",
    min: 4,
    expiry: "07/2027",
    batch: "MC-902",
    cost: "R$ 39",
  },
  {
    name: "Gaze estéril",
    quantity: 14,
    unit: "pc",
    min: 5,
    expiry: "—",
    batch: "GZ-441",
    cost: "R$ 12",
  },
];

export type Bill = {
  name: string;
  value: string;
  due: string;
  status: StatusTone;
  recurrence: string;
};
export const bills: Bill[] = [
  {
    name: "Aluguel da sala",
    value: "R$ 900",
    due: "05 set",
    status: "pending",
    recurrence: "Mensal",
  },
  { name: "Energia", value: "R$ 148", due: "12 set", status: "pending", recurrence: "Mensal" },
  {
    name: "Fornecedor Dermaline",
    value: "R$ 320",
    due: "28 ago",
    status: "cancelled",
    recurrence: "Avulsa",
  },
  { name: "Internet", value: "R$ 99", due: "02 set", status: "confirmed", recurrence: "Mensal" },
];

export type Move = { label: string; value: string; kind: "in" | "out"; when: string };
export const moves: Move[] = [
  { label: "Mariana Silva · limpeza de pele", value: "+ R$ 180", kind: "in", when: "hoje 15:20" },
  { label: "Compra de insumos", value: "- R$ 214", kind: "out", when: "ontem" },
  { label: "Bruna Antunes · drenagem", value: "+ R$ 180", kind: "in", when: "ontem" },
  { label: "Aluguel da sala", value: "- R$ 900", kind: "out", when: "28 ago" },
];

/** Livro-caixa: de onde vem cada valor do resumo do mês. */
export type LedgerKind = "entradas" | "saidas" | "receber";
export type LedgerEntry = {
  id: string;
  kind: LedgerKind;
  date: string;
  label: string;
  origin: string;
  method: string;
  value: number;
  due?: string;
};
export const ledger: LedgerEntry[] = [
  {
    id: "l1",
    kind: "entradas",
    date: "2026-09-01",
    label: "Mariana Silva",
    origin: "Limpeza de pele · sessão 2",
    method: "Pix",
    value: 180,
  },
  {
    id: "l2",
    kind: "entradas",
    date: "2026-08-31",
    label: "Bruna Antunes",
    origin: "Drenagem facial · sessão 3",
    method: "Cartão de crédito",
    value: 180,
  },
  {
    id: "l3",
    kind: "entradas",
    date: "2026-08-29",
    label: "Renata Dias",
    origin: "Hidratação facial",
    method: "Pix",
    value: 150,
  },
  {
    id: "l4",
    kind: "entradas",
    date: "2026-08-27",
    label: "Juliana Prado",
    origin: "Pacote peeling · 3 sessões",
    method: "Cartão · 3x",
    value: 480,
  },
  {
    id: "l5",
    kind: "entradas",
    date: "2026-08-24",
    label: "Ana Lúcia",
    origin: "Limpeza de pele",
    method: "Dinheiro",
    value: 180,
  },
  {
    id: "l6",
    kind: "entradas",
    date: "2026-08-20",
    label: "Venda de produto",
    origin: "Protetor solar FPS 50",
    method: "Pix",
    value: 89,
  },
  {
    id: "l7",
    kind: "entradas",
    date: "2026-08-18",
    label: "Paula Andrade",
    origin: "Pacote limpeza · 4 sessões",
    method: "Cartão · 4x",
    value: 640,
  },
  {
    id: "l8",
    kind: "entradas",
    date: "2026-08-14",
    label: "Bruna Antunes",
    origin: "Pacote drenagem · 6 sessões",
    method: "Pix",
    value: 960,
  },
  {
    id: "l9",
    kind: "entradas",
    date: "2026-08-11",
    label: "Camila Rocha",
    origin: "Peeling suave",
    method: "Cartão de débito",
    value: 160,
  },
  {
    id: "l10",
    kind: "entradas",
    date: "2026-08-07",
    label: "Mariana Silva",
    origin: "Limpeza de pele · sessão 1",
    method: "Pix",
    value: 180,
  },
  {
    id: "l11",
    kind: "entradas",
    date: "2026-08-05",
    label: "Letícia Moura",
    origin: "Hidratação facial",
    method: "Pix",
    value: 150,
  },
  {
    id: "l12",
    kind: "entradas",
    date: "2026-08-02",
    label: "Venda de produto",
    origin: "Sérum vitamina C",
    method: "Dinheiro",
    value: 120,
  },
  {
    id: "h1",
    kind: "entradas",
    date: "2026-07-28",
    label: "Juliana Prado",
    origin: "Avaliação inicial",
    method: "Pix",
    value: 120,
  },
  {
    id: "h2",
    kind: "entradas",
    date: "2026-07-21",
    label: "Renata Dias",
    origin: "Limpeza de pele",
    method: "Cartão de crédito",
    value: 180,
  },
  {
    id: "h3",
    kind: "saidas",
    date: "2026-07-28",
    label: "Aluguel da sala",
    origin: "Conta recorrente",
    method: "Transferência",
    value: 900,
  },
  {
    id: "h4",
    kind: "saidas",
    date: "2026-07-12",
    label: "Compra de insumos",
    origin: "Dermaline · argila, máscara calmante",
    method: "Boleto",
    value: 176,
  },
  {
    id: "s1",
    kind: "saidas",
    date: "2026-08-31",
    label: "Compra de insumos",
    origin: "Dermaline · ácido mandélico, gaze",
    method: "Boleto",
    value: 214,
  },
  {
    id: "s2",
    kind: "saidas",
    date: "2026-08-28",
    label: "Aluguel da sala",
    origin: "Conta recorrente",
    method: "Transferência",
    value: 900,
  },
  {
    id: "s3",
    kind: "saidas",
    date: "2026-08-22",
    label: "Energia",
    origin: "Conta recorrente",
    method: "Débito automático",
    value: 148,
  },
  {
    id: "s4",
    kind: "saidas",
    date: "2026-08-15",
    label: "Internet",
    origin: "Conta recorrente",
    method: "Débito automático",
    value: 99,
  },
  {
    id: "r1",
    kind: "receber",
    date: "2026-09-04",
    label: "Mariana Silva",
    origin: "Sessão 2 · pagamento pendente",
    method: "Pix",
    value: 180,
    due: "2026-09-04",
  },
  {
    id: "r2",
    kind: "receber",
    date: "2026-09-10",
    label: "Juliana Prado",
    origin: "Pacote peeling · parcela 2 de 3",
    method: "Cartão",
    value: 160,
    due: "2026-09-27",
  },
  {
    id: "r3",
    kind: "receber",
    date: "2026-09-12",
    label: "Camila Ferraz",
    origin: "Avaliação inicial · agendada",
    method: "A definir",
    value: 120,
    due: "2026-09-12",
  },
];
