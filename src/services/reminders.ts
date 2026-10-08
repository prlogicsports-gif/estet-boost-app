import {
  appointmentsDb,
  billsDb,
  careDb,
  clientsDb,
  defaultPrefs,
  ledgerDb,
  prefsDb,
  stockDb,
} from "@/data/db";
import { addDays, daysBetween, instantOf, todayISO } from "@/lib/dates";
import { notify } from "@/services/notify";

const brl = (value: number) => `R$ ${Math.round(value).toLocaleString("pt-BR")}`;
const first = (text: string) => text.split(/[.!?]/)[0]?.trim() ?? text;

/** "vence hoje", "vence amanhã", "vence em 3 dias". */
const dueText = (days: number) =>
  days === 0 ? "vence hoje" : days === 1 ? "vence amanhã" : `vence em ${days} dias`;

/**
 * Regras de lembrete. Cada uma gera no máximo uma notificação por chave, então rodar
 * isto a cada minuto é seguro. Estas são as mesmas regras que um agendador na nuvem
 * (Cloud Functions + FCM) vai executar quando o banco entrar: veja docs/NOTIFICACOES-FIREBASE.md.
 */
export function runReminders(now = new Date()): number {
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const prefs = prefsDb.get();
  const gestor = { ...defaultPrefs, ...prefs["gestor"] };
  const cliente = { ...defaultPrefs, ...prefs["cliente"] };
  let created = 0;
  const push = (...args: Parameters<typeof notify>) => {
    if (notify(...args)) created += 1;
  };

  const appointments = appointmentsDb
    .get()
    .filter((item) => !item.done && item.status !== "cancelled");
  const clients = clientsDb.get();

  // ── esteticista ──
  if (gestor.appointments) {
    for (const a of appointments) {
      if (a.date !== today) continue;
      const start = Number(a.time.slice(0, 2)) * 60 + Number(a.time.slice(3, 5));
      if (a.status === "pending" && !a.request) {
        push({
          audience: "gestor",
          kind: "reminder",
          title: `${a.client.split(" ")[0]} ainda não confirmou`,
          body: `${a.procedure} · hoje ${a.time}`,
          href: `/atendimentos/${a.id}`,
          ruleKey: `unconf:${a.id}:${today}`,
        });
      }
      const until = start - minutesNow;
      if (until >= 0 && until <= 60) {
        push({
          audience: "gestor",
          kind: "reminder",
          title: `Próximo atendimento em ${until} min`,
          body: `${a.client} · ${a.procedure}`,
          href: `/atendimentos/${a.id}`,
          ruleKey: `soon:${a.id}`,
        });
      }
    }
  }

  if (gestor.payments) {
    for (const bill of billsDb.get()) {
      if (bill.paid) continue;
      const days = daysBetween(today, bill.due);
      if (days >= 0 && days <= 3) {
        push({
          audience: "gestor",
          kind: "bill",
          title: `${bill.name} ${dueText(days)}`,
          body: `${brl(bill.value)} · ${bill.recurrence.toLowerCase()}`,
          href: "/gestao",
          ruleKey: `bill:${bill.id}:${today}`,
        });
      } else if (days < 0) {
        push({
          audience: "gestor",
          kind: "bill",
          title: `${bill.name} está atrasada`,
          body: `${brl(bill.value)} · venceu há ${-days} ${-days === 1 ? "dia" : "dias"}`,
          href: "/gestao",
          ruleKey: `bill-late:${bill.id}:${today}`,
        });
      }
    }
    for (const entry of ledgerDb.get()) {
      if (entry.kind !== "receber") continue;
      const days = daysBetween(today, entry.due ?? entry.date);
      if (days >= 0 && days <= 3) {
        push({
          audience: "gestor",
          kind: "bill",
          title: `Cobrança de ${entry.label.split(" ")[0]} ${dueText(days)}`,
          body: `${brl(entry.value)} · ${entry.origin}`,
          href: "/gestao",
          ruleKey: `recv:${entry.id}:${today}`,
        });
      }
    }
  }

  if (gestor.stock) {
    for (const item of stockDb.get()) {
      if (item.quantity <= item.min) {
        push({
          audience: "gestor",
          kind: "stock",
          title: "Estoque baixo",
          body: `${item.name} · ${item.quantity} ${item.unit} (mínimo ${item.min})`,
          href: "/gestao",
          ruleKey: `stock:${item.name}:${item.quantity}`,
        });
      }
    }
  }

  if (gestor.appointments) {
    for (const client of clients) {
      if (client.alert === "Sem atendimento recente") {
        push({
          audience: "gestor",
          kind: "followup",
          title: "Cliente no período de retorno",
          body: `${client.name} · ${client.lastVisit} sem atendimento`,
          href: `/clientes/${client.id}`,
          ruleKey: `cold:${client.id}`,
        });
      }
    }
  }

  // ── cliente ──
  if (cliente.appointments) {
    for (const a of appointments) {
      if (a.date === tomorrow) {
        push({
          audience: "cliente",
          clientId: a.clientId,
          kind: "reminder",
          title: "Seu atendimento é amanhã",
          body: `${a.procedure} · ${a.time}`,
          href: "/cliente/agenda",
          ruleKey: `r24:${a.id}`,
        });
      } else if (a.date === today) {
        push({
          audience: "cliente",
          clientId: a.clientId,
          kind: "reminder",
          title: "Seu atendimento é hoje",
          body: `${a.procedure} · às ${a.time}`,
          href: "/cliente/agenda",
          ruleKey: `r0:${a.id}`,
        });
      }
    }
  }

  if (cliente.payments) {
    for (const entry of ledgerDb.get()) {
      if (entry.kind !== "receber") continue;
      const owner = clients.find((client) => client.name === entry.label);
      if (!owner) continue;
      const days = daysBetween(today, entry.due ?? entry.date);
      if (days >= 0 && days <= 3) {
        push({
          audience: "cliente",
          clientId: owner.id,
          kind: "bill",
          title: `Pagamento ${dueText(days)}`,
          body: `${brl(entry.value)} · ${entry.origin}`,
          href: "/cliente",
          ruleKey: `crecv:${entry.id}:${today}`,
        });
      }
    }
  }

  if (cliente.recommendations) {
    for (const care of careDb.get()) {
      if (!care.reminderTime || (care.until && care.until < today)) continue;
      const at = Number(care.reminderTime.slice(0, 2)) * 60 + Number(care.reminderTime.slice(3, 5));
      if (minutesNow < at) continue;
      push({
        audience: "cliente",
        clientId: care.clientId,
        kind: "recommendation",
        title: `Lembrete das ${care.reminderTime}`,
        body: first(care.text),
        href: "/cliente/evolucao",
        createdAt: instantOf(today, care.reminderTime),
        ruleKey: `care:${care.id}:${today}`,
      });
    }
  }

  return created;
}
