import type { StatusTone } from "@/components/eb/status-badge";
import type { NotificationKind } from "@/components/eb/notification-center";

export type AppointmentStatus = Extract<StatusTone, "confirmed" | "pending" | "cancelled">;

export type AppointmentRec = {
  id: string;
  clientId: string;
  client: string;
  initials: string;
  procedure: string;
  /** ISO `AAAA-MM-DD`. */
  date: string;
  time: string;
  duration: number;
  price: number;
  payment: string;
  status: AppointmentStatus;
  kind: "retorno" | "primeira";
  session?: number | undefined;
  sessionsTotal?: number | undefined;
  /** Quem criou: a esteticista agenda como confirmado; a cliente solicita e fica aguardando. */
  origin: "gestor" | "cliente";
  /** Pedido da cliente que a esteticista ainda precisa aprovar ou recusar. */
  request?: boolean | undefined;
  /** Remarcação pedida pela cliente, com a data e o horário que ela propõe. */
  reschedule?: boolean | undefined;
  proposedDate?: string | undefined;
  proposedTime?: string | undefined;
  /** Cancelamento com menos de 24 horas: a esteticista precisa aprovar. */
  cancelRequest?: boolean | undefined;
  alert?: string | undefined;
  notes?: string | undefined;
  /** Atendimento já realizado. */
  done?: boolean | undefined;
  createdAt: string;
};

export type Audience = "gestor" | "cliente";

export type NotificationRec = {
  id: string;
  audience: Audience;
  /** Para a cliente: de qual cliente é a notificação. */
  clientId?: string | undefined;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Instante ISO completo. */
  createdAt: string;
  read: boolean;
  /** Para onde a notificação leva ao tocar. */
  href?: string | undefined;
  /** Chave de uma regra automática: evita avisar duas vezes a mesma coisa. */
  ruleKey?: string | undefined;
};

export type BillRec = {
  id: string;
  name: string;
  value: number;
  /** ISO `AAAA-MM-DD`. */
  due: string;
  recurrence: "Mensal" | "Avulsa";
  paid: boolean;
};

export type CareRec = {
  id: string;
  clientId: string;
  text: string;
  /** Recomendação que a cliente vê. Com `reminderTime`, ela é lembrada nesse horário todos os dias. */
  createdAt: string;
  reminderTime?: string | undefined;
  /** Até quando o lembrete diário vale. */
  until?: string | undefined;
};

export type NotificationPrefs = {
  appointments: boolean;
  payments: boolean;
  stock: boolean;
  recommendations: boolean;
  push: boolean;
  whatsapp: boolean;
};

/** Clínica: cada esteticista tem a sua, com um link e credenciais próprios para filiar clientes. */

export type StockRec = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  min: number;
  /** Validade ISO `AAAA-MM-DD`; vazio quando não vence. */
  expiry: string;
  batch: string;
  /** Custo por unidade, em reais. */
  cost: number;
  supplier: string;
};

/** Procedimentos que a clínica oferece, com preço e retorno sugerido. */
export type ProcedureRec = {
  id: string;
  name: string;
  price: number;
  duration: number;
  returnDays: number;
  /** Produtos que o procedimento costuma usar: pré-preenchem a etapa de produtos do atendimento. */
  products?: { stockId: string; qty: number }[] | undefined;
};

export type AnamnesisRec = {
  clientId: string;
  answers: Record<string, string | string[]>;
  consent: boolean;
  updatedAt: string;
};

export type SessionProcedure = { name: string; price: number };
export type SessionProduct = { stockId: string; name: string; qty: number; unitCost: number };

/** Atendimento em andamento: salvo sozinho a cada alteração, para retomar de onde parou. */
export type SessionRec = {
  id: string;
  /** Horário da agenda a que pertence, quando houver. */
  apptId?: string | undefined;
  clientId: string;
  client: string;
  initials: string;
  procedure: string;
  step: number;
  procedures: SessionProcedure[];
  products: SessionProduct[];
  beforePhotoId?: string | undefined;
  afterPhotoId?: string | undefined;
  notes: Record<string, string>;
  payment: string;
  /** Se o valor já foi pago ou fica a receber. */
  paidNow: boolean;
  dueDate: string;
  status: "draft" | "done";
  startedAt: string;
  finishedAt?: string | undefined;
};

/** Registro de tudo o que acontece na clínica (cliente e esteticista), para consulta em Gestão. */
export type ActivityRec = {
  id: string;
  at: string;
  by: "cliente" | "gestor";
  kind: "horario" | "pagamento" | "cadastro" | "atendimento";
  clientId?: string | undefined;
  client: string;
  text: string;
};

export type BlockRec = { id: string; date: string; start: string; end: string; reason: string };

export type DayHours = { open: boolean; start: string; end: string };
export type HoursRec = { days: Record<string, DayHours>; slot: number };

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
  /** Cliente a quem a cobrança pertence. */
  clientId?: string;
  /** Quem gerou o lançamento (atendimento ou conta), para corrigir junto se algo for editado. */
  refId?: string;
  /** A cliente avisou que pagou; a esteticista ainda precisa confirmar o recebimento. */
  reported?: { at: string; method: string };
};
