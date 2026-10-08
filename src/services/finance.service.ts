import { billsDb, ledgerDb, stockDb } from "@/data/db";
import type { LedgerEntry } from "@/data/gestor-mock";
import { todayISO } from "@/lib/dates";
import type { BillRec, SessionProduct, StockRec } from "@/lib/models";
import { events } from "@/services/notification-events";
import { notify } from "@/services/notify";

const newId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export function addLedgerEntry(entry: Omit<LedgerEntry, "id">) {
  ledgerDb.set((list) => [{ ...entry, id: newId("l") }, ...list]);
}

export function addBill(input: {
  name: string;
  value: number;
  due: string;
  recurrence: BillRec["recurrence"];
}) {
  billsDb.set((list) => [...list, { id: newId("b"), paid: false, ...input }]);
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
    id: existing?.id ?? input.id ?? newId("s"),
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

/** Dá baixa nos produtos usados e avisa se algum ficou no mínimo. */
export function consumeStock(used: Pick<SessionProduct, "stockId" | "qty">[]) {
  const before = stockDb.get();
  stockDb.set((list) =>
    list.map((item) => {
      const hit = used.find((entry) => entry.stockId === item.id);
      return hit
        ? { ...item, quantity: Math.max(0, Math.round((item.quantity - hit.qty) * 100) / 100) }
        : item;
    }),
  );
  for (const item of stockDb.get()) {
    const old = before.find((entry) => entry.id === item.id);
    if (old && old.quantity > old.min && item.quantity <= item.min) notify(events.stockLow(item));
  }
}

/** A cliente avisa que pagou: a esteticista ainda precisa confirmar o recebimento. */
export function reportPayment(entryId: string, method: string) {
  const entry = ledgerDb.get().find((item) => item.id === entryId);
  if (!entry || entry.reported) return;
  ledgerDb.set((list) =>
    list.map((item) =>
      item.id === entryId
        ? { ...item, method, reported: { at: new Date().toISOString(), method } }
        : item,
    ),
  );
  notify(events.paymentReported(entry, method));
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
