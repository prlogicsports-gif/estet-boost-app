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
