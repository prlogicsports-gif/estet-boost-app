import type { Client } from "@/components/eb/client-card";
import type { LedgerEntry } from "@/lib/models";
import { createStore } from "@/lib/db";
import type {
  ActivityRec,
  AnamnesisRec,
  AppointmentRec,
  BillRec,
  BlockRec,
  CareRec,
  HoursRec,
  NotificationPrefs,
  NotificationRec,
  ProcedureRec,
  SessionRec,
  StockRec,
} from "@/lib/models";

/**
 * Coleções do app. Começam vazias: nenhum dado de exemplo. Tudo vive no aparelho por enquanto
 * (será migrado para o Supabase área por área); os serviços em `src/services` são o único lugar que grava.
 */
export type ClientRec = Client & {
  email?: string | undefined;
  createdAt: string;
  /** Nascimento ISO; a idade é calculada a partir dele. */
  birth?: string | undefined;
  document?: string | undefined;
  address?: string | undefined;
  /** Autorização de uso interno das fotografias. */
  imageConsent?: boolean | undefined;
};

export const defaultPrefs: NotificationPrefs = {
  appointments: true,
  payments: true,
  stock: true,
  recommendations: true,
  push: true,
  whatsapp: false,
};

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

/** Horário de atendimento inicial (a gestora ajusta em Configurações). */
export const DEFAULT_HOURS: HoursRec = {
  slot: 30,
  days: {
    "0": { open: false, start: "09:00", end: "13:00" },
    "1": { open: true, start: "09:00", end: "19:00" },
    "2": { open: true, start: "09:00", end: "19:00" },
    "3": { open: true, start: "09:00", end: "19:00" },
    "4": { open: true, start: "09:00", end: "19:00" },
    "5": { open: true, start: "09:00", end: "19:00" },
    "6": { open: true, start: "09:00", end: "13:00" },
  },
};

export const clientsDb = createStore<ClientRec[]>("eb:v1:clientes", () => []);
export const appointmentsDb = createStore<AppointmentRec[]>("eb:v1:atendimentos", () => []);
export const notificationsDb = createStore<NotificationRec[]>("eb:v1:notificacoes", () => []);
export const billsDb = createStore<BillRec[]>("eb:v1:contas", () => []);
export const ledgerDb = createStore<LedgerEntry[]>("eb:v1:caixa", () => []);
export const stockDb = createStore<StockRec[]>("eb:v1:estoque-v2", () => []);
export const careDb = createStore<CareRec[]>("eb:v1:cuidados", () => []);
export const proceduresDb = createStore<ProcedureRec[]>("eb:v1:procedimentos", () => []);
export const anamnesisDb = createStore<AnamnesisRec[]>("eb:v1:anamneses", () => []);
export const sessionsDb = createStore<SessionRec[]>("eb:v1:sessoes", () => []);
export const blocksDb = createStore<BlockRec[]>("eb:v1:bloqueios", () => []);
export const hoursDb = createStore<HoursRec>("eb:v1:horarios", () => DEFAULT_HOURS);
export const activityDb = createStore<ActivityRec[]>("eb:v1:historico", () => []);
export const settingsDb = createStore<Settings>("eb:v1:configuracoes", () => DEFAULT_SETTINGS);
export const prefsDb = createStore<Record<string, NotificationPrefs>>("eb:v1:preferencias", () => ({
  gestor: { ...defaultPrefs },
  cliente: { ...defaultPrefs },
}));
