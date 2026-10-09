import { billsDb, ledgerDb, stockDb } from "@/data/db";
import type { LedgerEntry } from "@/lib/models";
import { todayISO } from "@/lib/dates";
import type { BillRec, StockRec } from "@/lib/models";
import { events } from "@/services/notification-events";
import { logActivity } from "@/services/activity.service";
import { notify } from "@/services/notify";
import { supabase } from "@/lib/supabase";
import { newId } from "@/lib/uuid";
import { brl } from "@/lib/view";

export function addLedgerEntry(entry: Omit<LedgerEntry, "id">) {
  ledgerDb.set((list) => [{ ...entry, id: newId() }, ...list]);
}

export function addBill(input: {
  name: string;
  value: number;
  due: string;
  recurrence: BillRec["recurrence"];
}) {
  billsDb.set((list) => [...list, { id: newId(), paid: false, ...input }]);
}

/** Paga a conta: ela sai do "a pagar" e vira uma saída no caixa. */
export function payBill(id: string) {
  const bill = billsDb.get().find((item) => item.id === id);
  if (!bill || bill.paid) return;
  billsDb.set((list) => list.map((item) => (item.id === id ? { ...item, paid: true } : item)));
  addLedgerEntry({
    kind: "saidas",
    date: todayISO(),
    label: bill.name,
    refId: bill.id,
    origin: bill.recurrence === "Mensal" ? "Conta recorrente" : "Conta avulsa",
    method: "Transferência",
    value: bill.value,
  });
}

/** Cria o produto ou, se o id já existe, atualiza. Com `addQuantity`, soma ao que já tem (reposição). */
export function saveStock(
  input: Omit<StockRec, "id"> & { id?: string },
  addQuantity = false,
): StockRec {
  const existing = stockDb
    .get()
    .find((item) => item.id === input.id || item.name.toLowerCase() === input.name.toLowerCase());
  const rec: StockRec = {
    ...input,
    id: existing?.id ?? input.id ?? newId(),
    quantity: addQuantity && existing ? existing.quantity + input.quantity : input.quantity,
  };
  stockDb.set((list) =>
    existing ? list.map((item) => (item.id === existing.id ? rec : item)) : [...list, rec],
  );
  if (rec.quantity <= rec.min) notify(events.stockLow(rec));
  return rec;
}

export function removeStock(id: string) {
  stockDb.set((list) => list.filter((item) => item.id !== id));
}

/** A cliente avisa que pagou: o servidor registra, avisa a gestora e ela ainda precisa confirmar o recebimento. */
export function reportPayment(entryId: string, method: string) {
  void supabase
    .rpc("report_payment", { p_entry_id: entryId, p_method: method })
    .then(() => ledgerDb.reload());
}

/** A esteticista confirma o recebimento: a cobrança vira entrada no caixa. */
export function confirmPayment(entryId: string) {
  const entry = ledgerDb.get().find((item) => item.id === entryId);
  if (!entry) return;
  ledgerDb.set((list) =>
    list.map((item) => {
      if (item.id !== entryId) return item;
      const { reported, ...rest } = item;
      return {
        ...rest,
        kind: "entradas",
        date: todayISO(),
        method: reported?.method ?? item.method,
      };
    }),
  );
  if (entry.clientId) notify(events.paymentConfirmed(entry));
  logActivity({
    by: "gestor",
    kind: "pagamento",
    clientId: entry.clientId,
    client: entry.label,
    text: `Confirmou recebimento de ${brl(entry.value)}`,
  });
}

/** Não encontrou o pagamento: a cobrança volta a ficar em aberto e a cliente é avisada. */
export function rejectPayment(entryId: string) {
  const entry = ledgerDb.get().find((item) => item.id === entryId);
  if (!entry) return;
  ledgerDb.set((list) =>
    list.map((item) => {
      if (item.id !== entryId) return item;
      const { reported: _reported, ...rest } = item;
      return rest;
    }),
  );
  if (entry.clientId) notify(events.paymentNotFound(entry));
  logActivity({
    by: "gestor",
    kind: "pagamento",
    clientId: entry.clientId,
    client: entry.label,
    text: `Não localizou o pagamento de ${brl(entry.value)}`,
  });
}

/** Registra que uma cobrança a receber foi paga direto pela esteticista. */
export function receivePayment(id: string, method: string) {
  const entry = ledgerDb.get().find((item) => item.id === id);
  if (!entry) return;
  ledgerDb.set((list) =>
    list.map((item) =>
      item.id === id ? { ...item, kind: "entradas", date: todayISO(), method } : item,
    ),
  );
  if (entry.clientId) notify(events.paymentConfirmed(entry));
}

/** Corrige um lançamento (valor, data, descrição, forma). O que veio de um atendimento acompanha. */
export function updateLedgerEntry(id: string, patch: Partial<Omit<LedgerEntry, "id">>) {
  ledgerDb.set((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
}

export function removeLedgerEntry(id: string) {
  ledgerDb.set((list) => list.filter((item) => item.id !== id));
}

/** Desfaz um recebimento marcado por engano: volta a ser cobrança em aberto. */
export function reopenReceivable(id: string) {
  ledgerDb.set((list) =>
    list.map((item) => {
      if (item.id !== id || item.kind !== "entradas" || !item.due) return item;
      return { ...item, kind: "receber", date: item.due };
    }),
  );
}

export function updateBill(id: string, patch: Partial<Omit<BillRec, "id" | "paid">>) {
  billsDb.set((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
}

export function removeBill(id: string) {
  billsDb.set((list) => list.filter((item) => item.id !== id));
  ledgerDb.set((list) => list.filter((item) => item.refId !== id));
}

/** Desfaz o pagamento de uma conta: sai o lançamento do caixa e ela volta a ficar a pagar. */
export function reopenBill(id: string) {
  billsDb.set((list) => list.map((item) => (item.id === id ? { ...item, paid: false } : item)));
  ledgerDb.set((list) => list.filter((item) => item.refId !== id));
}
