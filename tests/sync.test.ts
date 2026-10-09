import { beforeEach, describe, expect, mock, test } from "bun:test";

// ---- Supabase falso, em memória: registra o que o app pediu e devolve linhas combinadas.
type Row = Record<string, unknown>;
const tables = new Map<string, Row[]>();
const calls: { table: string; op: string; row?: Row; match?: [string, unknown] }[] = [];
const rpcs: { name: string; args: unknown }[] = [];
let failTable: string | null = null;

function builder(table: string) {
  let op = "select";
  let row: Row | undefined;
  let match: [string, unknown] | undefined;
  const q: Record<string, unknown> = {
    select: () => q,
    order: () => q,
    insert: (r: Row) => ((op = "insert"), (row = r), q),
    update: (r: Row) => ((op = "update"), (row = r), q),
    upsert: (r: Row) => ((op = "upsert"), (row = r), q),
    delete: () => ((op = "delete"), q),
    eq: (col: string, val: unknown) => ((match = [col, val]), q),
    maybeSingle: () => q,
    then: (resolve: (value: unknown) => void) => {
      if (op === "select") return resolve({ data: tables.get(table) ?? [], error: null });
      calls.push({ table, op, ...(row ? { row } : {}), ...(match ? { match } : {}) });
      if (failTable === table) return resolve({ data: null, error: { message: "negado" } });
      return resolve({ data: null, error: null });
    },
  };
  return q;
}

const fake = {
  from: (table: string) => builder(table),
  rpc: (name: string, args: unknown) => {
    rpcs.push({ name, args });
    return Promise.resolve({ data: { ok: true }, error: null });
  },
  channel: () => ({
    on() {
      return this;
    },
    subscribe() {
      return this;
    },
  }),
  removeChannel: () => {},
  storage: {
    from: () => ({
      remove: () => Promise.resolve({}),
      createSignedUrls: () => Promise.resolve({ data: [] }),
    }),
  },
  auth: {
    onAuthStateChange: () => ({}),
    getSession: () => Promise.resolve({ data: { session: null } }),
    signOut: () => Promise.resolve({}),
  },
};
mock.module("@/lib/supabase", () => ({ supabase: fake }));

const events: { type: string; detail: string }[] = [];
(globalThis as Record<string, unknown>)["window"] = {
  dispatchEvent: (e: { type: string; detail: string }) => events.push(e),
  addEventListener() {},
  location: { origin: "http://x" },
};
(globalThis as Record<string, unknown>)["CustomEvent"] = class {
  type: string;
  detail: string;
  constructor(type: string, init: { detail: string }) {
    this.type = type;
    this.detail = init.detail;
  }
};

const { appointmentsDb, clientsDb, ledgerDb, sessionsDb, stockDb } = await import("@/data/db");
const { flushAll, startSync, stopSync } = await import("@/lib/remote-store");
import type { Session } from "@/lib/auth.types";

const all = {
  clientes: true,
  agenda: true,
  atendimentos: true,
  estoque: true,
  financeiro: true,
  historico: true,
};
const gestora: Session = {
  uid: "u1",
  role: "gestor",
  name: "Dona",
  email: "g@x.com",
  clinicId: "cl1",
  permissions: all,
};
const funcionaria: Session = {
  ...gestora,
  uid: "u2",
  role: "funcionario",
  permissions: { ...all, financeiro: false },
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
async function boot(session: Session) {
  stopSync();
  calls.length = 0;
  rpcs.length = 0;
  events.length = 0;
  failTable = null;
  startSync(session);
  await tick();
}

beforeEach(() => {
  tables.clear();
  tables.set("clients", [
    {
      id: "c1",
      name: "Ana Souza",
      phone: "11",
      main_procedure: "Limpeza",
      image_consent: false,
      created_at: "2026-01-01T00:00:00Z",
      last_visit: null,
      birth: "1990-05-10",
    },
  ]);
  tables.set("appointments", [
    {
      id: "a1",
      client_id: "c1",
      client_name: "Ana Souza",
      procedure: "Limpeza",
      date: "2026-02-01",
      time: "10:00:00",
      duration: 60,
      status: "confirmed",
      kind: "retorno",
      origin: "gestor",
      request: false,
      reschedule: false,
      cancel_request: false,
      done: false,
      created_at: "2026-01-01T00:00:00Z",
      appointment_finance: [{ price: "180.00", payment: "Pix" }],
    },
  ]);
  tables.set("stock", [
    {
      id: "s1",
      name: "Ácido",
      category: "Ativo",
      quantity: "3.00",
      unit: "fr",
      min: "2.00",
      expiry: null,
      batch: null,
      stock_costs: [{ cost: "78.00", supplier: "Dermaline" }],
    },
  ]);
});

describe("leitura", () => {
  test("converte linhas do banco nos registros do app", async () => {
    await boot(gestora);
    const ana = clientsDb.get()[0]!;
    expect(ana).toMatchObject({
      id: "c1",
      name: "Ana Souza",
      initials: "AS",
      lastVisit: "—",
      mainProcedure: "Limpeza",
    });
    expect(ana.age).toBeGreaterThan(30);
    const a = appointmentsDb.get()[0]!;
    expect(a).toMatchObject({
      time: "10:00",
      price: 180,
      payment: "Pix",
      client: "Ana Souza",
      initials: "AS",
    });
    expect(stockDb.get()[0]).toMatchObject({
      quantity: 3,
      cost: 78,
      supplier: "Dermaline",
      expiry: "",
    });
  });

  test("sem permissão financeira o valor não vem (a tabela de valores volta vazia)", async () => {
    tables.set("appointments", [{ ...tables.get("appointments")![0]!, appointment_finance: [] }]);
    await boot(funcionaria);
    expect(appointmentsDb.get()[0]).toMatchObject({ price: 0, payment: "A definir" });
  });
});

describe("escrita", () => {
  test("cliente nova vai ao banco com a clínica e as colunas certas", async () => {
    await boot(gestora);
    clientsDb.set((list) => [
      ...list,
      {
        id: "c2",
        name: "Bia",
        initials: "B",
        mainProcedure: "Peeling",
        lastVisit: "—",
        nextReturn: "—",
        status: "neutral",
        age: 0,
        phone: "119",
        createdAt: "x",
        email: "bia@x.com",
      },
    ]);
    await flushAll();
    const insert = calls.find((c) => c.table === "clients" && c.op === "insert")!;
    expect(insert.row).toMatchObject({
      id: "c2",
      clinic_id: "cl1",
      name: "Bia",
      main_procedure: "Peeling",
      email: "bia@x.com",
      image_consent: false,
    });
  });

  test("a cliente da carteira vem antes da agenda que a usa", async () => {
    await boot(gestora);
    clientsDb.set((list) => [
      ...list,
      {
        id: "c3",
        name: "Carla",
        initials: "C",
        mainProcedure: "x",
        lastVisit: "—",
        nextReturn: "—",
        status: "neutral",
        age: 0,
        phone: "",
        createdAt: "x",
      },
    ]);
    appointmentsDb.set((list) => [
      ...list,
      {
        id: "a3",
        clientId: "c3",
        client: "Carla",
        initials: "C",
        procedure: "x",
        date: "2026-03-01",
        time: "09:00",
        duration: 60,
        price: 100,
        payment: "Pix",
        status: "confirmed",
        kind: "primeira",
        origin: "gestor",
        createdAt: "x",
      },
    ]);
    await flushAll();
    const order = calls.filter((c) => c.op === "insert").map((c) => c.table);
    expect(order.indexOf("clients")).toBeLessThan(order.indexOf("appointments"));
  });

  test("alterações seguidas no mesmo registro viram uma gravação só", async () => {
    await boot(gestora);
    const edit = (note: string) =>
      clientsDb.set((list) => list.map((c) => (c.id === "c1" ? { ...c, note } : c)));
    edit("a");
    edit("ab");
    edit("abc");
    await flushAll();
    const updates = calls.filter((c) => c.table === "clients" && c.op === "update");
    expect(updates.length).toBe(1);
    expect(updates[0]!.row).toMatchObject({ note: "abc" });
    expect(updates[0]!.match).toEqual(["id", "c1"]);
  });

  test("valor do horário só é gravado por quem tem permissão financeira", async () => {
    await boot(gestora);
    appointmentsDb.set((list) => list.map((a) => ({ ...a, price: 200 })));
    await flushAll();
    expect(calls.some((c) => c.table === "appointment_finance" && c.op === "upsert")).toBe(true);
    await boot(funcionaria);
    appointmentsDb.set((list) => list.map((a) => ({ ...a, price: 300, notes: "n" })));
    await flushAll();
    expect(calls.some((c) => c.table === "appointment_finance")).toBe(false);
    expect(calls.some((c) => c.table === "appointments" && c.op === "update")).toBe(true);
  });

  test("apagar registro apaga no banco", async () => {
    await boot(gestora);
    clientsDb.set([]);
    await flushAll();
    expect(calls.find((c) => c.table === "clients" && c.op === "delete")?.match).toEqual([
      "id",
      "c1",
    ]);
  });

  test("rascunho do atendimento não leva custo nem grava atendimento fechado", async () => {
    await boot(gestora);
    sessionsDb.set((list) => [
      ...list,
      {
        id: "s1",
        clientId: "c1",
        client: "Ana",
        initials: "A",
        procedure: "Limpeza",
        step: 2,
        procedures: [{ name: "Limpeza", price: 180 }],
        products: [{ stockId: "s1", name: "Ácido", qty: 2, unitCost: 78 }],
        notes: {},
        payment: "Pix",
        paidNow: true,
        dueDate: "",
        status: "draft",
        startedAt: "x",
      },
      {
        id: "s2",
        clientId: "c1",
        client: "Ana",
        initials: "A",
        procedure: "Antigo",
        step: 8,
        procedures: [],
        products: [],
        notes: {},
        payment: "Pix",
        paidNow: true,
        dueDate: "",
        status: "done",
        startedAt: "x",
      },
    ]);
    await flushAll();
    const rows = calls.filter((c) => c.table === "sessions");
    expect(rows.length).toBe(1);
    const data = (rows[0]!.row as { data: { products: Record<string, unknown>[] } }).data;
    expect(data.products[0]).toEqual({ stockId: "s1", name: "Ácido", qty: 2 });
    expect(JSON.stringify(rows[0]!.row)).not.toContain("78");
  });
});

describe("falhas", () => {
  test("se o banco recusar, a tela volta ao que está no servidor e a pessoa é avisada", async () => {
    await boot(gestora);
    failTable = "appointments";
    appointmentsDb.set((list) => [
      ...list,
      {
        id: "a9",
        clientId: "c1",
        client: "Ana",
        initials: "A",
        procedure: "x",
        date: "2026-05-01",
        time: "08:00",
        duration: 60,
        price: 0,
        payment: "A definir",
        status: "confirmed",
        kind: "retorno",
        origin: "gestor",
        createdAt: "x",
      },
    ]);
    expect(appointmentsDb.get().some((a) => a.id === "a9")).toBe(true); // otimista
    await flushAll();
    await tick();
    expect(appointmentsDb.get().some((a) => a.id === "a9")).toBe(false);
    expect(events.some((e) => e.type === "eb:sync-error")).toBe(true);
  });

  test("ao sair da conta os dados somem da memória", async () => {
    await boot(gestora);
    expect(clientsDb.get().length).toBe(1);
    stopSync();
    expect(clientsDb.get().length).toBe(0);
    expect(ledgerDb.get().length).toBe(0);
  });
});
