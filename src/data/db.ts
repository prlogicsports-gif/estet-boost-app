import type { Client } from "@/components/eb/client-card";
import { daysBetween, todayISO } from "@/lib/dates";
import { initialsOf } from "@/lib/initials";
import type {
  ActivityRec,
  AnamnesisRec,
  AppointmentRec,
  BillRec,
  BlockRec,
  CareRec,
  HoursRec,
  LedgerEntry,
  NotificationPrefs,
  NotificationRec,
  ProcedureRec,
  SessionRec,
  StockRec,
} from "@/lib/models";
import { createRemoteDoc, createRemoteStore, type Row, type SyncCtx } from "@/lib/remote-store";
import { supabase } from "@/lib/supabase";

/**
 * Coleções do app, todas no Supabase e compartilhadas entre as pessoas da clínica (cada uma vê só o que
 * o RLS permite). Os serviços em `src/services` são o único lugar que grava. Cada coleção diz como
 * ler uma linha do banco e como gravar um registro.
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
  /** A cliente já tem conta (login) ligada à ficha. */
  hasAccess?: boolean | undefined;
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

// ---------------------------------------------------------------- utilidades de leitura/gravação
const num = (value: unknown) => (value === null || value === undefined ? 0 : Number(value));
const hm = (value: unknown) => (typeof value === "string" ? value.slice(0, 5) : undefined);
const opt = <T>(value: T | null | undefined) =>
  value === null || value === undefined || value === "" ? undefined : value;
const orNull = (value: string | undefined) => (value === undefined || value === "" ? null : value);
const first = <T>(embed: T | T[] | null | undefined): T | undefined =>
  Array.isArray(embed) ? embed[0] : (embed ?? undefined);

async function write(table: string, rec: Row, prev: unknown, key = "id") {
  if (prev === undefined) {
    const { error } = await supabase.from(table).insert(rec);
    if (error) throw error;
    return;
  }
  // Atualizar 0 linhas = o banco não deixou (RLS) ou o registro não existe mais: vira erro de permissão
  const { data, error } = await supabase.from(table).update(rec).eq(key, rec[key]).select(key);
  if (error) throw error;
  if (!data || data.length === 0) throw { code: "EB_NOROWS", message: "0 linhas atualizadas" };
}

async function drop(table: string, id: string, key = "id") {
  const { error } = await supabase.from(table).delete().eq(key, id);
  if (error) throw error;
}

const visitLabel = (date: string | null) => {
  if (!date) return "—";
  const days = daysBetween(date, todayISO());
  return days <= 0 ? "hoje" : days === 1 ? "ontem" : `há ${days} dias`;
};

const ageOf = (birth: string | null) => {
  if (!birth) return 0;
  const born = new Date(`${birth}T12:00:00`);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  if (
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())
  )
    age -= 1;
  return Math.max(0, age);
};

// ---------------------------------------------------------------- clientes
export const clientsDb = createRemoteStore<ClientRec>({
  key: "clients",
  label: (rec) => `Cliente ${rec.name}`,
  table: "clients",
  order: { column: "name" },
  fromRow: (r) => ({
    id: r.id,
    name: r.name,
    initials: initialsOf(r.name),
    mainProcedure: r.main_procedure,
    lastVisit: visitLabel(r.last_visit),
    nextReturn: "—",
    status: "neutral",
    ...(r.last_visit && daysBetween(r.last_visit, todayISO()) >= 60
      ? { alert: "Sem atendimento recente" }
      : {}),
    age: ageOf(r.birth),
    phone: r.phone ?? "",
    goal: opt(r.goal),
    allergies: opt(r.allergies),
    contra: opt(r.contra),
    note: opt(r.note),
    email: opt(r.email),
    createdAt: r.created_at,
    birth: opt(r.birth),
    document: opt(r.document),
    address: opt(r.address),
    imageConsent: r.image_consent,
    hasAccess: Boolean(r.user_id),
  }),
  save: (rec, prev, ctx) =>
    write(
      "clients",
      {
        id: rec.id,
        clinic_id: ctx.session.clinicId,
        name: rec.name,
        phone: rec.phone,
        email: orNull(rec.email),
        birth: orNull(rec.birth),
        document: orNull(rec.document),
        address: orNull(rec.address),
        goal: orNull(rec.goal),
        allergies: orNull(rec.allergies),
        contra: orNull(rec.contra),
        note: orNull(rec.note),
        main_procedure: rec.mainProcedure,
        image_consent: Boolean(rec.imageConsent),
        ...(rec.imageConsent !== (prev as ClientRec | undefined)?.imageConsent
          ? { image_consent_at: new Date().toISOString() }
          : {}),
      },
      prev,
    ),
  remove: (rec) => drop("clients", rec.id),
});

// ---------------------------------------------------------------- agenda
export const appointmentsDb = createRemoteStore<AppointmentRec>({
  key: "appointments",
  label: (rec) => `Horário de ${rec.client} em ${rec.date} às ${rec.time}`,
  table: "appointments",
  select: "*, appointment_finance(price, payment)",
  watch: ["appointment_finance"],
  order: { column: "date" },
  fromRow: (r) => {
    const fin = first<{ price: number; payment: string }>(r.appointment_finance);
    return {
      id: r.id,
      clientId: r.client_id,
      client: r.client_name,
      initials: initialsOf(r.client_name ?? ""),
      procedure: r.procedure,
      date: r.date,
      time: hm(r.time) ?? "",
      duration: r.duration,
      price: num(fin?.price),
      payment: fin?.payment ?? "A definir",
      status: r.status,
      kind: r.kind,
      session: opt(r.session_no),
      sessionsTotal: opt(r.sessions_total),
      origin: r.origin,
      request: r.request,
      reschedule: r.reschedule,
      proposedDate: opt(r.proposed_date),
      proposedTime: hm(opt(r.proposed_time)),
      cancelRequest: r.cancel_request,
      alert: opt(r.alert),
      notes: opt(r.notes),
      done: r.done,
      createdAt: r.created_at,
    };
  },
  save: async (rec, prev, ctx) => {
    await write(
      "appointments",
      {
        id: rec.id,
        clinic_id: ctx.session.clinicId,
        client_id: rec.clientId,
        client_name: rec.client,
        procedure: rec.procedure,
        date: rec.date,
        time: rec.time,
        duration: rec.duration,
        status: rec.status,
        kind: rec.kind,
        origin: rec.origin,
        request: Boolean(rec.request),
        reschedule: Boolean(rec.reschedule),
        proposed_date: orNull(rec.proposedDate),
        proposed_time: orNull(rec.proposedTime),
        cancel_request: Boolean(rec.cancelRequest),
        done: Boolean(rec.done),
        notes: orNull(rec.notes),
        alert: orNull(rec.alert),
        session_no: rec.session ?? null,
        sessions_total: rec.sessionsTotal ?? null,
      },
      prev,
    );
    // valor e forma de pagamento ficam numa tabela só de quem tem permissão financeira
    if (ctx.can("financeiro")) {
      const { error } = await supabase.from("appointment_finance").upsert(
        {
          appt_id: rec.id,
          clinic_id: ctx.session.clinicId,
          price: rec.price,
          payment: rec.payment,
        },
        { onConflict: "appt_id" },
      );
      if (error) throw error;
    }
  },
  remove: (rec) => drop("appointments", rec.id),
});

// ---------------------------------------------------------------- avisos (criados no servidor; a pessoa só marca como lida)
export const notificationsDb = createRemoteStore<NotificationRec>({
  key: "notifications",
  label: () => "Aviso",
  table: "notifications",
  order: { column: "created_at", ascending: false },
  fromRow: (r, ctx) => ({
    id: r.id,
    audience: ctx.session.role === "cliente" ? "cliente" : "gestor",
    ...(ctx.session.clientId ? { clientId: ctx.session.clientId } : {}),
    kind: r.kind,
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
    read: r.read,
    href: opt(r.href),
    ruleKey: r.rule_key,
  }),
  save: async (rec, prev) => {
    if (!prev) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read: rec.read })
      .eq("id", rec.id);
    if (error) throw error;
  },
  onLoaded: (prev, next) => {
    // aviso novo com o app aberto: o banner do app mostra por cima da tela (ver NotificationBanner)
    if (!prev.length || typeof window === "undefined") return;
    const known = new Set(prev.map((item) => item.id));
    for (const item of next)
      if (!item.read && !known.has(item.id))
        window.dispatchEvent(new CustomEvent("eb:notification", { detail: item }));
  },
});

// ---------------------------------------------------------------- financeiro
export const billsDb = createRemoteStore<BillRec>({
  key: "bills",
  label: (rec) => `Conta ${rec.name}`,
  table: "bills",
  order: { column: "due" },
  fromRow: (r) => ({
    id: r.id,
    name: r.name,
    value: num(r.value),
    due: r.due,
    recurrence: r.recurrence,
    paid: r.paid,
  }),
  save: (rec, prev, ctx) =>
    write(
      "bills",
      {
        id: rec.id,
        clinic_id: ctx.session.clinicId,
        name: rec.name,
        value: rec.value,
        due: rec.due,
        recurrence: rec.recurrence,
        paid: rec.paid,
      },
      prev,
    ),
  remove: (rec) => drop("bills", rec.id),
});

export const ledgerDb = createRemoteStore<LedgerEntry>({
  key: "ledger",
  label: (rec) => `Lançamento ${rec.label}`,
  table: "ledger",
  order: { column: "date", ascending: false },
  fromRow: (r) => ({
    id: r.id,
    kind: r.kind,
    date: r.date,
    label: r.label,
    origin: r.origin,
    method: r.method,
    value: num(r.value),
    ...(r.due ? { due: r.due } : {}),
    ...(r.client_id ? { clientId: r.client_id } : {}),
    ...(r.ref_id ? { refId: r.ref_id } : {}),
    ...(r.reported ? { reported: r.reported } : {}),
  }),
  save: (rec, prev, ctx) =>
    write(
      "ledger",
      {
        id: rec.id,
        clinic_id: ctx.session.clinicId,
        kind: rec.kind,
        date: rec.date,
        due: orNull(rec.due),
        label: rec.label,
        origin: rec.origin,
        method: rec.method,
        value: rec.value,
        client_id: orNull(rec.clientId),
        ref_id: orNull(rec.refId),
        reported: rec.reported ?? null,
      },
      prev,
    ),
  remove: (rec) => drop("ledger", rec.id),
});

// ---------------------------------------------------------------- estoque (o custo mora numa tabela só do financeiro)
export const stockDb = createRemoteStore<StockRec>({
  key: "stock",
  label: (rec) => `Produto ${rec.name}`,
  table: "stock",
  select: "*, stock_costs(cost, supplier)",
  watch: ["stock_costs"],
  order: { column: "name" },
  fromRow: (r) => {
    const cost = first<{ cost: number; supplier: string | null }>(r.stock_costs);
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      quantity: num(r.quantity),
      unit: r.unit,
      min: num(r.min),
      expiry: r.expiry ?? "",
      batch: r.batch ?? "",
      cost: num(cost?.cost),
      supplier: cost?.supplier ?? "",
    };
  },
  save: async (rec, prev, ctx) => {
    await write(
      "stock",
      {
        id: rec.id,
        clinic_id: ctx.session.clinicId,
        name: rec.name,
        category: rec.category,
        quantity: rec.quantity,
        unit: rec.unit,
        min: rec.min,
        expiry: orNull(rec.expiry),
        batch: orNull(rec.batch),
      },
      prev,
    );
    if (ctx.can("financeiro")) {
      const { error } = await supabase.from("stock_costs").upsert(
        {
          stock_id: rec.id,
          clinic_id: ctx.session.clinicId,
          cost: rec.cost,
          supplier: orNull(rec.supplier),
        },
        { onConflict: "stock_id" },
      );
      if (error) throw error;
    }
  },
  remove: (rec) => drop("stock", rec.id),
});

// ---------------------------------------------------------------- clínico
export const careDb = createRemoteStore<CareRec>({
  key: "care",
  label: () => "Recomendação",
  table: "care",
  order: { column: "created_at", ascending: false },
  fromRow: (r) => ({
    id: r.id,
    clientId: r.client_id,
    text: r.text,
    createdAt: r.created_at,
    reminderTime: hm(opt(r.reminder_time)),
    until: opt(r.until),
  }),
  save: (rec, prev, ctx) =>
    write(
      "care",
      {
        id: rec.id,
        clinic_id: ctx.session.clinicId,
        client_id: rec.clientId,
        text: rec.text,
        reminder_time: orNull(rec.reminderTime),
        until: orNull(rec.until),
      },
      prev,
    ),
  remove: (rec) => drop("care", rec.id),
});

export const anamnesisDb = createRemoteStore<AnamnesisRec>({
  key: "anamnesis",
  label: () => "Anamnese",
  table: "anamnesis",
  idOf: (rec) => rec.clientId,
  fromRow: (r) => ({
    clientId: r.client_id,
    answers: r.answers ?? {},
    consent: r.consent,
    updatedAt: r.updated_at,
  }),
  save: async (rec, _prev, ctx) => {
    const { error } = await supabase.from("anamnesis").upsert(
      {
        client_id: rec.clientId,
        clinic_id: ctx.session.clinicId,
        answers: rec.answers,
        consent: rec.consent,
        updated_at: rec.updatedAt,
      },
      { onConflict: "client_id" },
    );
    if (error) throw error;
  },
  remove: (rec) => drop("anamnesis", rec.clientId, "client_id"),
});

export const proceduresDb = createRemoteStore<ProcedureRec>({
  key: "procedures",
  label: (rec) => `Procedimento ${rec.name}`,
  table: "procedures",
  order: { column: "name" },
  fromRow: (r) => ({
    id: r.id,
    name: r.name,
    price: num(r.price),
    duration: r.duration,
    returnDays: r.return_days,
  }),
  save: (rec, prev, ctx) =>
    write(
      "procedures",
      {
        id: rec.id,
        clinic_id: ctx.session.clinicId,
        name: rec.name,
        price: rec.price,
        duration: rec.duration,
        return_days: rec.returnDays,
      },
      prev,
    ),
  remove: (rec) => drop("procedures", rec.id),
});

// ---------------------------------------------------------------- atendimento (rascunho no banco; fechar é função do servidor)
export const sessionsDb = createRemoteStore<SessionRec>({
  key: "sessions",
  label: (rec) => `Atendimento de ${rec.client}`,
  table: "sessions",
  select: "*, session_finance(items, paid_now, payment, due_date)",
  watch: ["session_finance"],
  order: { column: "started_at" },
  fromRow: (r) => {
    const d = r.data ?? {};
    const fin = first<{
      items: { name: string; price: number }[];
      paid_now: boolean;
      payment: string;
      due_date: string | null;
    }>(r.session_finance);
    const costOf = (stockId: string) =>
      stockDb.get().find((item) => item.id === stockId)?.cost ?? 0;
    return {
      id: r.id,
      apptId: opt(r.appt_id),
      clientId: r.client_id,
      client: d.client ?? "",
      initials: d.initials ?? initialsOf(d.client ?? ""),
      procedure: r.procedure,
      step: r.step,
      procedures: (fin?.items ?? d.procedures ?? []).map((p: Row) => ({
        name: p.name,
        price: num(p.price),
      })),
      products: (d.products ?? []).map((p: Row) => ({
        stockId: p.stockId,
        name: p.name,
        qty: num(p.qty),
        unitCost: costOf(p.stockId),
      })),
      beforePhotoId: opt(d.beforePhotoId),
      afterPhotoId: opt(d.afterPhotoId),
      notes: r.notes ?? {},
      payment: fin?.payment ?? d.payment ?? "Pix",
      paidNow: fin?.paid_now ?? d.paidNow ?? true,
      dueDate: fin?.due_date ?? d.dueDate ?? "",
      status: r.status,
      startedAt: r.started_at,
      finishedAt: opt(r.finished_at),
    };
  },
  save: async (rec, prev, ctx) => {
    if (rec.status === "done") return; // atendimento fechado só muda por função do servidor
    await write(
      "sessions",
      {
        id: rec.id,
        clinic_id: ctx.session.clinicId,
        appt_id: rec.apptId ?? null,
        client_id: rec.clientId,
        procedure: rec.procedure,
        step: rec.step,
        status: "draft",
        notes: rec.notes,
        staff_id: ctx.session.uid,
        data: {
          client: rec.client,
          initials: rec.initials,
          procedures: rec.procedures,
          products: rec.products.map((p) => ({ stockId: p.stockId, name: p.name, qty: p.qty })),
          payment: rec.payment,
          paidNow: rec.paidNow,
          dueDate: rec.dueDate,
          beforePhotoId: rec.beforePhotoId ?? null,
          afterPhotoId: rec.afterPhotoId ?? null,
        },
      },
      prev,
    );
  },
  remove: (rec) => (rec.status === "draft" ? drop("sessions", rec.id) : Promise.resolve()),
});

// ---------------------------------------------------------------- agenda: bloqueios e horários
export const blocksDb = createRemoteStore<BlockRec>({
  key: "blocks",
  label: (rec) => `Bloqueio em ${rec.date}`,
  table: "blocks",
  order: { column: "date" },
  fromRow: (r) => ({
    id: r.id,
    date: r.date,
    start: hm(r.start) ?? "",
    end: hm(r.end) ?? "",
    reason: r.reason ?? "",
  }),
  save: (rec, prev, ctx) =>
    write(
      "blocks",
      {
        id: rec.id,
        clinic_id: ctx.session.clinicId,
        date: rec.date,
        start: rec.start,
        end: rec.end,
        reason: rec.reason,
      },
      prev,
    ),
  remove: (rec) => drop("blocks", rec.id),
});

async function loadConfig(ctx: SyncCtx, column: "hours" | "settings") {
  const { data, error } = await supabase
    .from("clinic_config")
    .select(column)
    .eq("clinic_id", ctx.session.clinicId)
    .maybeSingle();
  if (error) throw error;
  return (data as Row | null)?.[column] ?? null;
}
async function saveConfig(ctx: SyncCtx, column: "hours" | "settings", value: unknown) {
  const { error } = await supabase
    .from("clinic_config")
    .update({ [column]: value })
    .eq("clinic_id", ctx.session.clinicId);
  if (error) throw error;
}

export const hoursDb = createRemoteDoc<HoursRec>({
  key: "hours",
  table: "clinic_config",
  initial: DEFAULT_HOURS,
  load: (ctx) => loadConfig(ctx, "hours"),
  save: (value, ctx) => saveConfig(ctx, "hours", value),
});

export const settingsDb = createRemoteDoc<Settings>({
  key: "settings",
  table: "clinic_config",
  initial: DEFAULT_SETTINGS,
  load: (ctx) => loadConfig(ctx, "settings"),
  save: (value, ctx) => saveConfig(ctx, "settings", value),
});

// ---------------------------------------------------------------- histórico de eventos (escrito pelo servidor)
export const activityDb = createRemoteStore<ActivityRec>({
  key: "activity",
  table: "activity",
  order: { column: "at", ascending: false },
  fromRow: (r) => ({
    id: r.id,
    at: r.at,
    by: r.by_role === "cliente" ? "cliente" : "gestor",
    kind: r.kind,
    ...(r.client_id ? { clientId: r.client_id } : {}),
    client: r.client_name ?? "",
    text: r.text,
  }),
});

// ---------------------------------------------------------------- preferências de aviso da própria pessoa
const defaultPrefsMap = (): Record<string, NotificationPrefs> => ({
  gestor: { ...defaultPrefs },
  cliente: { ...defaultPrefs },
});

export const prefsDb = createRemoteDoc<Record<string, NotificationPrefs>>({
  key: "prefs",
  table: "prefs",
  initial: defaultPrefsMap(),
  load: async (ctx) => {
    const { data, error } = await supabase
      .from("prefs")
      .select("data")
      .eq("user_id", ctx.session.uid)
      .maybeSingle();
    if (error) throw error;
    const stored = (data as Row | null)?.data as Record<string, NotificationPrefs> | undefined;
    return stored && Object.keys(stored).length ? { ...defaultPrefsMap(), ...stored } : null;
  },
  save: async (value, ctx) => {
    const { error } = await supabase
      .from("prefs")
      .upsert({ user_id: ctx.session.uid, data: value }, { onConflict: "user_id" });
    if (error) throw error;
  },
});
