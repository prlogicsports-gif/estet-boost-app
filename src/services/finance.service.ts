import type { StockEntry } from "@/components/eb/stock-item";
import { billsDb, ledgerDb, stockDb } from "@/data/db";
import type { LedgerEntry } from "@/data/gestor-mock";
import { todayISO } from "@/lib/dates";
import type { BillRec } from "@/lib/models";

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

export function addStockItem(input: StockEntry) {
  stockDb.set((list) => {
    const index = list.findIndex((item) => item.name.toLowerCase() === input.name.toLowerCase());
    if (index < 0) return [...list, input];
    const next = list.slice();
    const current = next[index];
    if (current) next[index] = { ...current, quantity: current.quantity + input.quantity };
    return next;
  });
}

export function consumeStock(names: string[], quantity = 1) {
  stockDb.set((list) =>
    list.map((item) =>
      names.includes(item.name)
        ? { ...item, quantity: Math.max(0, item.quantity - quantity) }
        : item,
    ),
  );
}

/** Registra que uma cobrança a receber foi paga. */
export function receivePayment(id: string, method: string) {
  const entry = ledgerDb.get().find((item) => item.id === id);
  if (!entry) return;
  ledgerDb.set((list) =>
    list.map((item) =>
      item.id === id ? { ...item, kind: "entradas", date: todayISO(), method } : item,
    ),
  );
}
