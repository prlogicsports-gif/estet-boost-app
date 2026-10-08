import type { ClientRec } from "@/data/db";
import type { LedgerEntry } from "@/data/gestor-mock";
import { formatWeekday } from "@/lib/dates";
import type { AppointmentRec, BillRec, CareRec, ClinicRec, StockRec } from "@/lib/models";
import { brl } from "@/lib/view";
import type { NotificationDraft } from "@/services/notify";

/**
 * Catálogo único de notificações do app. Cada evento diz quem recebe, o que a pessoa lê
 * e para onde o toque leva. Os serviços só chamam `notify(events.algumaCoisa(...))`,
 * e as Cloud Functions do Firebase vão ler este mesmo catálogo (docs/NOTIFICACOES-FIREBASE.md).
 */
const when = (a: Pick<AppointmentRec, "date" | "time">) => `${formatWeekday(a.date)} · ${a.time}`;
const first = (name: string) => name.split(" ")[0] ?? name;
const dueText = (days: number) =>
  days === 0 ? "vence hoje" : days === 1 ? "vence amanhã" : `vence em ${days} dias`;
const sentence = (text: string) => text.split(/[.!?]/)[0]?.trim() ?? text;

const toGestor = (draft: Omit<NotificationDraft, "audience">): NotificationDraft => ({
  audience: "gestor",
  ...draft,
});
const toCliente = (
  clientId: string,
  draft: Omit<NotificationDraft, "audience" | "clientId">,
): NotificationDraft => ({ audience: "cliente", clientId, ...draft });

export const events = {
  // ── para a esteticista ──
  clientRegistered: (client: ClientRec, via: "link" | "cadastro") =>
    toGestor({
      kind: "followup",
      title: "Nova cliente na carteira",
      body: `${client.name} ${via === "link" ? "se cadastrou pelo seu link" : "foi cadastrada"}`,
      href: `/clientes/${client.id}`,
    }),
  appointmentRequested: (a: AppointmentRec) =>
    toGestor({
      kind: "request",
      title: "Nova solicitação de horário",
      body: `${a.client} · ${when(a)}`,
      href: "/agenda",
    }),
  rescheduleRequested: (a: AppointmentRec, date: string, time: string) =>
    toGestor({
      kind: "reschedule",
      title: "Pedido de remarcação",
      body: `${a.client} propõe ${formatWeekday(date)} · ${time}`,
      href: `/atendimentos/${a.id}`,
    }),
  cancelRequested: (a: AppointmentRec) =>
    toGestor({
      kind: "reschedule",
      title: "Pedido de cancelamento",
      body: `${a.client} · ${when(a)} (menos de 24 h)`,
      href: `/atendimentos/${a.id}`,
    }),
  cancelledByClient: (a: AppointmentRec) =>
    toGestor({
      kind: "reschedule",
      title: "Horário cancelado",
      body: `${a.client} · ${when(a)}`,
      href: "/agenda",
    }),
  confirmedByClient: (a: AppointmentRec) =>
    toGestor({
      kind: "confirmed",
      title: `${first(a.client)} confirmou presença`,
      body: `${a.procedure} · ${when(a)}`,
      href: `/atendimentos/${a.id}`,
    }),
  paymentReported: (entry: LedgerEntry, method: string) =>
    toGestor({
      kind: "payment",
      title: `${first(entry.label)} informou um pagamento`,
      body: `${brl(entry.value)} · ${method} · confirme o recebimento`,
      href: "/gestao?aba=receber",
      ruleKey: `preport:${entry.id}:${method}`,
    }),
  stockLow: (item: StockRec) =>
    toGestor({
      kind: "stock",
      title: "Estoque baixo",
      body: `${item.name} · ${item.quantity} ${item.unit} (mínimo ${item.min})`,
      href: "/gestao?aba=estoque",
      ruleKey: `stock:${item.id}:${item.quantity}`,
    }),
  stockExpiring: (item: StockRec, days: number) =>
    toGestor({
      kind: "stock",
      title: `${item.name} ${dueText(days).replace("vence", "vence")}`,
      body: `Validade de ${item.quantity} ${item.unit} · use primeiro`,
      href: "/gestao?aba=estoque",
      ruleKey: `expiring:${item.id}:${item.expiry}`,
    }),
  stockExpired: (item: StockRec) =>
    toGestor({
      kind: "stock",
      title: `${item.name} está vencido`,
      body: `${item.quantity} ${item.unit} não devem ser usados`,
      href: "/gestao?aba=estoque",
      ruleKey: `expired:${item.id}:${item.expiry}`,
    }),
  billDue: (bill: BillRec, days: number, today: string) =>
    toGestor({
      kind: "bill",
      title: `${bill.name} ${dueText(days)}`,
      body: `${brl(bill.value)} · ${bill.recurrence.toLowerCase()}`,
      href: "/gestao?aba=contas",
      ruleKey: `bill:${bill.id}:${today}`,
    }),
  billLate: (bill: BillRec, daysLate: number, today: string) =>
    toGestor({
      kind: "bill",
      title: `${bill.name} está atrasada`,
      body: `${brl(bill.value)} · venceu há ${daysLate} ${daysLate === 1 ? "dia" : "dias"}`,
      href: "/gestao?aba=contas",
      ruleKey: `bill-late:${bill.id}:${today}`,
    }),
  receivableDue: (entry: LedgerEntry, days: number, today: string) =>
    toGestor({
      kind: "bill",
      title: `Cobrança de ${first(entry.label)} ${dueText(days)}`,
      body: `${brl(entry.value)} · ${entry.origin}`,
      href: "/gestao?aba=receber",
      ruleKey: `recv:${entry.id}:${today}`,
    }),
  unconfirmed: (a: AppointmentRec, today: string) =>
    toGestor({
      kind: "reminder",
      title: `${first(a.client)} ainda não confirmou`,
      body: `${a.procedure} · hoje ${a.time}`,
      href: `/atendimentos/${a.id}`,
      ruleKey: `unconf:${a.id}:${today}`,
    }),
  startsSoon: (a: AppointmentRec, minutes: number) =>
    toGestor({
      kind: "reminder",
      title: `Próximo atendimento em ${minutes} min`,
      body: `${a.client} · ${a.procedure}`,
      href: `/atendimentos/${a.id}`,
      ruleKey: `soon:${a.id}`,
    }),
  clientCold: (client: ClientRec) =>
    toGestor({
      kind: "followup",
      title: "Cliente no período de retorno",
      body: `${client.name} · ${client.lastVisit} sem atendimento`,
      href: `/clientes/${client.id}`,
      ruleKey: `cold:${client.id}`,
    }),
  marginAlert: (clientName: string, procedure: string, costShare: number, sessionId: string) =>
    toGestor({
      kind: "stock",
      title: "Produtos pesaram no atendimento",
      body: `${first(clientName)} · ${procedure}: ${Math.round(costShare * 100)}% do valor foi custo de produto`,
      href: "/gestao",
      ruleKey: `margin:${sessionId}`,
    }),

  // ── para a cliente ──
  affiliated: (clientId: string, clinic: Pick<ClinicRec, "name">) =>
    toCliente(clientId, {
      kind: "confirmed",
      title: `Você agora faz parte de ${clinic.name}`,
      body: "Acompanhe horários, evolução e recomendações por aqui",
      href: "/cliente",
    }),
  appointmentScheduled: (a: AppointmentRec) =>
    toCliente(a.clientId, {
      kind: "reminder",
      title: "Novo horário agendado",
      body: `${a.procedure} · ${when(a)}`,
      href: "/cliente/agenda",
    }),
  requestApproved: (a: AppointmentRec) =>
    toCliente(a.clientId, {
      kind: "confirmed",
      title: "Horário confirmado",
      body: `${a.procedure} · ${when(a)}`,
      href: "/cliente/agenda",
    }),
  requestDeclined: (a: AppointmentRec) =>
    toCliente(a.clientId, {
      kind: "reschedule",
      title: "Horário não disponível",
      body: `${formatWeekday(a.date)} não está livre. Peça outro horário.`,
      href: "/cliente/agenda",
    }),
  confirmedByStudio: (a: AppointmentRec) =>
    toCliente(a.clientId, {
      kind: "confirmed",
      title: "Horário confirmado",
      body: `${a.procedure} · ${when(a)}`,
      href: "/cliente/agenda",
    }),
  cancelledByStudio: (a: AppointmentRec) =>
    toCliente(a.clientId, {
      kind: "reschedule",
      title: "Atendimento cancelado",
      body: `${a.procedure} · ${when(a)}. A sessão volta para o pacote.`,
      href: "/cliente/agenda",
    }),
  movedByStudio: (a: AppointmentRec, date: string, time: string) =>
    toCliente(a.clientId, {
      kind: "reschedule",
      title: "Horário alterado",
      body: `${a.procedure} passou para ${formatWeekday(date)} · ${time}`,
      href: "/cliente/agenda",
    }),
  rescheduleApproved: (a: AppointmentRec, date: string, time: string) =>
    toCliente(a.clientId, {
      kind: "confirmed",
      title: "Remarcação confirmada",
      body: `${a.procedure} · ${formatWeekday(date)} · ${time}`,
      href: "/cliente/agenda",
    }),
  rescheduleDeclined: (a: AppointmentRec) =>
    toCliente(a.clientId, {
      kind: "reschedule",
      title: "Remarcação não confirmada",
      body: `Seu horário continua em ${when(a)}.`,
      href: "/cliente/agenda",
    }),
  confirmPlease: (a: AppointmentRec) =>
    toCliente(a.clientId, {
      kind: "reminder",
      title: "Confirme seu atendimento de hoje",
      body: `${a.procedure} · às ${a.time}`,
      href: "/cliente/agenda",
    }),
  remindTomorrow: (a: AppointmentRec) =>
    toCliente(a.clientId, {
      kind: "reminder",
      title: "Seu atendimento é amanhã",
      body: `${a.procedure} · ${a.time}`,
      href: "/cliente/agenda",
      ruleKey: `r24:${a.id}`,
    }),
  remindToday: (a: AppointmentRec) =>
    toCliente(a.clientId, {
      kind: "reminder",
      title: "Seu atendimento é hoje",
      body: `${a.procedure} · às ${a.time}`,
      href: "/cliente/agenda",
      ruleKey: `r0:${a.id}`,
    }),
  careNew: (clientId: string, count: number, who: string) =>
    toCliente(clientId, {
      kind: "recommendation",
      title: `Novos cuidados de ${who}`,
      body: `${count} ${count === 1 ? "recomendação" : "recomendações"} para você`,
      href: "/cliente/evolucao",
    }),
  careReminder: (care: CareRec, today: string, createdAt: string) =>
    toCliente(care.clientId, {
      kind: "recommendation",
      title: `Lembrete das ${care.reminderTime}`,
      body: sentence(care.text),
      href: "/cliente/evolucao",
      createdAt,
      ruleKey: `care:${care.id}:${today}`,
    }),
  returnSuggested: (a: AppointmentRec) =>
    toCliente(a.clientId, {
      kind: "reminder",
      title: "Retorno sugerido",
      body: `${a.procedure} · ${when(a)}. Confirme sua presença.`,
      href: "/cliente/agenda",
    }),
  paymentDue: (entry: LedgerEntry, days: number, today: string) =>
    toCliente(entry.clientId ?? "", {
      kind: "bill",
      title: `Pagamento ${dueText(days)}`,
      body: `${brl(entry.value)} · ${entry.origin}`,
      href: "/cliente",
      ruleKey: `crecv:${entry.id}:${today}`,
    }),
  paymentConfirmed: (entry: LedgerEntry) =>
    toCliente(entry.clientId ?? "", {
      kind: "payment",
      title: "Pagamento confirmado",
      body: `${brl(entry.value)} · ${entry.origin}. Obrigada!`,
      href: "/cliente",
    }),
  paymentNotFound: (entry: LedgerEntry) =>
    toCliente(entry.clientId ?? "", {
      kind: "payment",
      title: "Não localizamos o pagamento",
      body: `${brl(entry.value)} · ${entry.origin}. Confira e informe novamente.`,
      href: "/cliente",
    }),
} as const;
