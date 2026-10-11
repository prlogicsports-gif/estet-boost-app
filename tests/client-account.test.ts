import { beforeEach, describe, expect, test } from "bun:test";

import { handle, type Env } from "../supabase/functions/create-client-account/index";

const env: Env = { url: "https://x.supabase.co", serviceKey: "service" };
const GESTORA = "11111111-1111-4111-8111-111111111111";
const CLINIC = "22222222-2222-4222-8222-222222222222";
const CLIENT = "33333333-3333-4333-8333-333333333333";
const NEW_USER = "44444444-4444-4444-8444-444444444444";
const OLD_USER = "55555555-5555-4555-8555-555555555555";

let profiles: Record<string, unknown>[];
let clients: Record<string, unknown>[];
let activity: unknown[];
let calls: { method: string; url: string; body?: Record<string, unknown> }[];
let createStatus: { status: number; body: Record<string, unknown> };
let rpcReply: Record<string, unknown>;
let loggedAs: string | null;

const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = init?.method ?? "GET";
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
  calls.push({ method, url, ...(body ? { body } : {}) });
  const ok = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
  if (url.endsWith("/auth/v1/user"))
    return loggedAs ? ok({ id: loggedAs }) : ok({ msg: "jwt" }, 401);
  if (url.includes("/rest/v1/profiles?")) {
    const id = /id=eq\.([^&]+)/.exec(url)?.[1];
    return ok(profiles.filter((row) => row["id"] === id));
  }
  if (url.includes("/rest/v1/clients?")) return ok(clients);
  if (url.includes("/rest/v1/activity?")) return ok(activity);
  if (url.endsWith("/rest/v1/rpc/client_access_event")) return ok(rpcReply);
  if (url.endsWith("/auth/v1/admin/users") && method === "POST")
    return ok(createStatus.body, createStatus.status);
  if (url.includes("/auth/v1/admin/users/")) return ok({});
  return ok([]);
}) as typeof fetch;

const call = (payload: Record<string, unknown>, token: string | null = "Bearer jwt") =>
  handle(
    new Request("https://x/functions/v1/create-client-account", {
      method: "POST",
      headers: token ? { authorization: token } : {},
      body: JSON.stringify(payload),
    }),
    env,
    fakeFetch,
  ).then((response) => response.json() as Promise<{ ok: boolean; reason?: string }>);

const valid = { client_id: CLIENT, email: "Paula@Email.com", password: "senha-forte-1" };

beforeEach(() => {
  calls = [];
  activity = [];
  loggedAs = GESTORA;
  createStatus = { status: 200, body: { id: NEW_USER } };
  rpcReply = { ok: true };
  profiles = [
    { id: GESTORA, clinic_id: CLINIC, role: "gestor", active: true, permissions: {} },
    { id: OLD_USER, clinic_id: CLINIC, role: "cliente" },
  ];
  clients = [{ id: CLIENT, clinic_id: CLINIC, user_id: null, name: "Paula Andrade" }];
});

describe("create-client-account", () => {
  test("cria o usuário confirmado, com e-mail em minúsculas, e liga à ficha", async () => {
    expect(await call(valid)).toEqual({ ok: true });
    const created = calls.find((c) => c.url.endsWith("/auth/v1/admin/users"))!;
    expect(created.body).toMatchObject({
      email: "paula@email.com",
      password: "senha-forte-1",
      email_confirm: true,
    });
    const linked = calls.find((c) => c.url.endsWith("/rpc/client_access_event"))!;
    expect(linked.body).toMatchObject({ p_mode: "create", p_user: NEW_USER, p_client: CLIENT });
  });

  test("a senha nunca vai para a função de registro do banco", async () => {
    await call(valid);
    const linked = calls.find((c) => c.url.endsWith("/rpc/client_access_event"))!;
    expect(JSON.stringify(linked.body)).not.toContain("senha-forte-1");
  });

  test("sem login ou com login inválido", async () => {
    expect((await call(valid, null)).reason).toBe("sem_login");
    loggedAs = null;
    expect((await call(valid)).reason).toBe("sem_login");
  });

  test("cliente e funcionária sem permissão de clientes não criam", async () => {
    profiles[0] = { id: GESTORA, clinic_id: CLINIC, role: "cliente", active: true };
    expect((await call(valid)).reason).toBe("sem_permissao");
    profiles[0] = {
      id: GESTORA,
      clinic_id: CLINIC,
      role: "funcionario",
      active: true,
      permissions: { agenda: true },
    };
    expect((await call(valid)).reason).toBe("sem_permissao");
    expect(calls.some((c) => c.url.endsWith("/auth/v1/admin/users"))).toBe(false);
  });

  test("funcionária com permissão de clientes cria", async () => {
    profiles[0] = {
      id: GESTORA,
      clinic_id: CLINIC,
      role: "funcionario",
      active: true,
      permissions: { clientes: true },
    };
    expect((await call(valid)).ok).toBe(true);
  });

  test("ficha de outra clínica não vale", async () => {
    clients = [
      { id: CLIENT, clinic_id: "99999999-9999-4999-8999-999999999999", user_id: null, name: "X" },
    ];
    expect((await call(valid)).reason).toBe("nao_encontrada");
  });

  test("valida e-mail, senha e id", async () => {
    expect((await call({ ...valid, email: "sem-arroba" })).reason).toBe("email_invalido");
    expect((await call({ ...valid, password: "curta" })).reason).toBe("senha_curta");
    expect((await call({ ...valid, client_id: "../x" })).reason).toBe("dados_invalidos");
  });

  test("ficha que já tem acesso é recusada", async () => {
    clients = [{ id: CLIENT, clinic_id: CLINIC, user_id: OLD_USER, name: "Paula" }];
    expect((await call(valid)).reason).toBe("ja_tem_acesso");
  });

  test("e-mail que já tem conta devolve aviso claro e não toca na conta existente", async () => {
    createStatus = { status: 422, body: { error_code: "email_exists", msg: "x" } };
    expect((await call(valid)).reason).toBe("email_em_uso");
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  test("se não conseguir ligar à ficha, apaga a conta que acabou de criar", async () => {
    rpcReply = { ok: false, reason: "ja_tem_acesso" };
    expect((await call(valid)).reason).toBe("ja_tem_acesso");
    expect(calls.some((c) => c.method === "DELETE" && c.url.endsWith(NEW_USER))).toBe(true);
  });

  test("limite por hora por clínica", async () => {
    activity = Array.from({ length: 40 }, (_, i) => ({ id: String(i) }));
    expect((await call(valid)).reason).toBe("limite");
  });

  test("redefinir senha: troca no Auth da conta existente", async () => {
    clients = [{ id: CLIENT, clinic_id: CLINIC, user_id: OLD_USER, name: "Paula" }];
    expect(await call({ ...valid, mode: "reset" })).toEqual({ ok: true });
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.url.endsWith(OLD_USER)).toBe(true);
    expect(put.body).toEqual({ password: "senha-forte-1" });
  });

  test("redefinir sem conta não faz nada", async () => {
    expect((await call({ ...valid, mode: "reset" })).reason).toBe("sem_acesso");
  });

  test("responde ao pré-voo CORS e recusa outros métodos", async () => {
    const pre = await handle(new Request("https://x/", { method: "OPTIONS" }), env, fakeFetch);
    expect(pre.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const get = await handle(new Request("https://x/", { method: "GET" }), env, fakeFetch);
    expect(get.status).toBe(405);
  });
});
