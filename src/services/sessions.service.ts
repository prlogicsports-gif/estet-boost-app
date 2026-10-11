import { appointmentsDb, clientsDb, proceduresDb, sessionsDb, stockDb } from "@/data/db";
import { addDays, todayISO } from "@/lib/dates";
import type { ProcedureRec, SessionProduct, SessionRec } from "@/lib/models";
import { reloadAll, runRpc } from "@/lib/remote-store";
import { newId } from "@/lib/uuid";

/** Se os produtos passam desta fatia do valor cobrado, a esteticista é avisada. */
export const MARGIN_ALERT = 0.35;

const find = (id: string) => sessionsDb.get().find((item) => item.id === id);

export const sessionTotals = (session: Pick<SessionRec, "procedures" | "products">) => {
  const price = session.procedures.reduce((sum, item) => sum + item.price, 0);
  const cost = session.products.reduce((sum, item) => sum + item.qty * item.unitCost, 0);
  return { price, cost, profit: price - cost, share: price > 0 ? cost / price : 0 };
};

/** Produtos do procedimento com nome e custo do estoque (itens que não existem mais são ignorados). */
export function productsFrom(
  stock: { id: string; name: string; cost: number }[],
  procedure: Pick<ProcedureRec, "products"> | undefined,
): SessionProduct[] {
  return (procedure?.products ?? []).flatMap(({ stockId, qty }) => {
    const item = stock.find((entry) => entry.id === stockId);
    return item && qty > 0 ? [{ stockId, name: item.name, qty, unitCost: item.cost }] : [];
  });
}

/** Soma `extra` aos produtos já marcados, sem duplicar (a quantidade já marcada vale). */
export function mergeProductLists(
  current: SessionProduct[],
  extra: SessionProduct[],
): SessionProduct[] {
  const add = extra.filter((item) => !current.some((entry) => entry.stockId === item.stockId));
  return add.length ? [...current, ...add] : current;
}

/** Produtos que o procedimento costuma usar, já com nome e custo do estoque. */
export const productsOfProcedure = (procedure: ProcedureRec | undefined): SessionProduct[] =>
  productsFrom(stockDb.get(), procedure);

/** Soma os produtos do procedimento aos já marcados no atendimento. */
export const mergeProducts = (
  current: SessionProduct[],
  procedure: ProcedureRec | undefined,
): SessionProduct[] => mergeProductLists(current, productsOfProcedure(procedure));

/** Cadastra um procedimento no catálogo (também usado na hora, dentro do atendimento). */
export function saveProcedure(input: Omit<ProcedureRec, "id"> & { id?: string }): ProcedureRec {
  const existing = proceduresDb
    .get()
    .find(
      (item) => item.id === input.id || item.name.toLowerCase() === input.name.trim().toLowerCase(),
    );
  const rec: ProcedureRec = {
    ...input,
    name: input.name.trim(),
    id: existing?.id ?? input.id ?? newId(),
  };
  proceduresDb.set((list) =>
    existing ? list.map((item) => (item.id === existing.id ? rec : item)) : [...list, rec],
  );
  return rec;
}

export function removeProcedure(id: string) {
  proceduresDb.set((list) => list.filter((item) => item.id !== id));
}

/**
 * Abre o atendimento: retoma o rascunho da mesma cliente (ou do mesmo horário) ou cria um novo.
 * Daqui em diante tudo é salvo a cada alteração.
 */
export function startSession(input: {
  clientId: string;
  procedure?: string;
  apptId?: string;
}): SessionRec | null {
  const open = sessionsDb
    .get()
    .find(
      (item) =>
        item.status === "draft" &&
        (input.apptId
          ? item.apptId === input.apptId
          : item.clientId === input.clientId && !item.apptId),
    );
  if (open) return open;
  const client = clientsDb.get().find((item) => item.id === input.clientId);
  if (!client) return null;
  const appt = input.apptId
    ? appointmentsDb.get().find((item) => item.id === input.apptId)
    : undefined;
  const name = input.procedure ?? appt?.procedure ?? "";
  const known = proceduresDb.get().find((item) => item.name === name);
  const rec: SessionRec = {
    id: newId(),
    apptId: input.apptId,
    clientId: client.id,
    client: client.name,
    initials: client.initials,
    procedure: name,
    step: 0,
    procedures: name ? [{ name, price: appt?.price || known?.price || 0 }] : [],
    products: productsOfProcedure(known),
    notes: {},
    payment: appt?.payment && appt.payment !== "A definir" ? appt.payment : "Pix",
    paidNow: true,
    dueDate: addDays(todayISO(), 7),
    status: "draft",
    startedAt: new Date().toISOString(),
  };
  sessionsDb.set((list) => [...list, rec]);
  return rec;
}

/** Salva qualquer alteração do atendimento na hora. */
export function updateSession(id: string, patch: Partial<Omit<SessionRec, "id">>) {
  sessionsDb.set((list) =>
    list.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, ...patch };
      // O nome do atendimento acompanha os procedimentos realizados.
      if (patch.procedures)
        next.procedure = patch.procedures.map((p) => p.name).join(" + ") || item.procedure;
      return next;
    }),
  );
}

/** Rascunho que ainda não recebeu nada: some ao cancelar para não deixar lixo na lista. */
export function discardIfEmpty(id: string) {
  const session = find(id);
  if (!session || session.status !== "draft") return;
  const untouched =
    session.step === 0 &&
    !session.products.length &&
    !session.beforePhotoId &&
    !Object.values(session.notes).some(Boolean) &&
    !session.apptId;
  if (untouched) sessionsDb.set((list) => list.filter((item) => item.id !== id));
}

export function cancelSession(id: string) {
  sessionsDb.set((list) => list.filter((item) => item.id !== id));
}

export type SessionResult = { ok: true; queued?: boolean } | { ok: false; message: string };

const REASONS: Record<string, string> = {
  sem_permissao: "Você não tem permissão para isso.",
  nao_encontrado: "Atendimento não encontrado.",
};
const failure = (reason?: string): SessionResult => ({
  ok: false,
  message: REASONS[reason ?? ""] ?? "Não foi possível concluir. Tente de novo.",
});

/**
 * Chama a função do servidor. O rascunho salvo vai na frente (a fila mantém a ordem). Sem internet, o pedido fica
 * guardado no aparelho e é concluído sozinho quando a conexão voltar (`queued`).
 */
async function callSession(
  name: string,
  args: Record<string, unknown>,
  label: string,
): Promise<SessionResult> {
  const outcome = await runRpc(name, args, { label });
  if (outcome.status === "queued") return { ok: true, queued: true };
  if (outcome.status === "rejected") return { ok: false, message: outcome.message };
  await reloadAll();
  const result = outcome.data as { ok: boolean; reason?: string };
  return result?.ok ? { ok: true } : failure(result?.reason);
}

/**
 * Fecha o atendimento no servidor, de uma vez só: caixa (pago agora ou a receber), baixa de estoque,
 * custo de produto, cuidados e retorno para a cliente, ficha atualizada e avisos. Quem não tem a
 * permissão financeira fecha com os preços da tabela e o valor fica a receber para a gestora conferir.
 */
export function completeSession(
  id: string,
  closing: { cuidados: string[]; retorno: { data: string; hora: string } | null },
): Promise<SessionResult> {
  return callSession(
    "complete_session",
    { p_session_id: id, p_cuidados: closing.cuidados, p_retorno: closing.retorno },
    "Fechar atendimento",
  );
}

/** Corrige um atendimento já finalizado. O caixa e a agenda acompanham (valores só com permissão financeira). */
export function editFinishedSession(
  id: string,
  patch: Pick<SessionRec, "procedures" | "notes" | "payment">,
): Promise<SessionResult> {
  return callSession(
    "edit_finished_session",
    {
      p_session_id: id,
      p_procedures: patch.procedures,
      p_notes: patch.notes,
      p_payment: patch.payment,
    },
    "Corrigir atendimento",
  );
}

/** Apaga um atendimento lançado por engano: sai do caixa, volta o estoque e a agenda (só gestora). */
export function deleteFinishedSession(id: string): Promise<SessionResult> {
  return callSession("delete_finished_session", { p_session_id: id }, "Apagar atendimento");
}

/** Produtos em falta para o que o atendimento pede (usado para avisar antes de finalizar). */
export const shortOnStock = (session: Pick<SessionRec, "products">) =>
  session.products.filter((used) => {
    const item = stockDb.get().find((entry) => entry.id === used.stockId);
    return item ? used.qty > item.quantity : false;
  });
