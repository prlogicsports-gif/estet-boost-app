import { beforeEach, describe, expect, test } from "bun:test";

import {
  accessToken,
  categoryOf,
  fcmMessage,
  handle,
  resetTokenCache,
  wantsPush,
  type Env,
} from "../supabase/functions/send-push/index";

// ---- conta de serviço de teste, com uma chave RSA gerada na hora
const pair = await crypto.subtle.generateKey(
  {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  },
  true,
  ["sign", "verify"],
);
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...pkcs8)).replace(/(.{64})/g, "$1\n")}\n-----END PRIVATE KEY-----\n`;
const account = {
  client_email: "push@estetboost.iam.gserviceaccount.com",
  private_key: pem,
  project_id: "estetboost",
};
const env: Env = {
  url: "https://x.supabase.co",
  serviceKey: "service",
  pushSecret: "segredo",
  serviceAccount: JSON.stringify(account),
};

const NID = "11111111-1111-4111-8111-111111111111";
let data: Record<string, unknown[]>;
let sends: { token: string; body: Record<string, unknown> }[];
let deletes: string[];
let fcmStatus: Record<string, { status: number; body: unknown }>;
let tokenCalls: number;

const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  if (url === "https://oauth2.googleapis.com/token") {
    tokenCalls += 1;
    const assertion = new URLSearchParams(String(init?.body)).get("assertion") ?? "";
    const [h, c, s] = assertion.split(".");
    const sig = Uint8Array.from(atob(s!.replace(/-/g, "+").replace(/_/g, "/")), (ch) =>
      ch.charCodeAt(0),
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      pair.publicKey,
      sig,
      new TextEncoder().encode(`${h}.${c}`),
    );
    const claims = JSON.parse(atob(c!.replace(/-/g, "+").replace(/_/g, "/")));
    if (
      !valid ||
      claims.iss !== account.client_email ||
      claims.scope !== "https://www.googleapis.com/auth/firebase.messaging"
    )
      return ok({}, 400);
    return ok({ access_token: "tok-google", expires_in: 3600 });
  }
  if (url.includes("fcm.googleapis.com")) {
    const body = JSON.parse(String(init?.body)).message;
    sends.push({ token: body.token, body });
    const forced = fcmStatus[body.token];
    return forced ? ok(forced.body, forced.status) : ok({ name: "projects/x/messages/1" });
  }
  if (init?.method === "DELETE") {
    deletes.push(decodeURIComponent(url.split("token=eq.")[1]!));
    return ok({});
  }
  for (const [table, rows] of Object.entries(data))
    if (url.includes(`/rest/v1/${table}?`)) return ok(rows);
  return ok([]);
}) as typeof fetch;

const call = (secret = "segredo", id = NID) =>
  handle(
    new Request("https://x/functions/v1/send-push", {
      method: "POST",
      headers: { "x-push-secret": secret },
      body: JSON.stringify({ id }),
    }),
    env,
    fakeFetch,
  );

beforeEach(() => {
  resetTokenCache();
  tokenCalls = 0;
  sends = [];
  deletes = [];
  fcmStatus = {};
  data = {
    notifications: [
      {
        id: NID,
        recipient_id: "u1",
        kind: "payment",
        title: "Maria informou um pagamento",
        body: "R$ 180 · Pix",
        href: "/gestao?aba=receber",
      },
    ],
    profiles: [{ role: "gestor" }],
    prefs: [],
    push_tokens: [{ token: "t-celular" }, { token: "t-notebook" }],
  };
});

describe("send-push", () => {
  test("envia a todos os aparelhos da pessoa, com os dados da notificação", async () => {
    const response = await call();
    expect(await response.json()).toEqual({ sent: 2 });
    expect(sends.map((s) => s.token)).toEqual(["t-celular", "t-notebook"]);
    expect(sends[0]!.body["data"]).toEqual({
      title: "Maria informou um pagamento",
      body: "R$ 180 · Pix",
      href: "/gestao?aba=receber",
      tag: NID,
    });
    expect(sends[0]!.body["notification"]).toBeUndefined(); // só dados: quem desenha é o service worker
  });

  test("autentica no Google com JWT RS256 assinado pela conta de serviço, uma vez só", async () => {
    await call();
    await call();
    expect(tokenCalls).toBe(1);
  });

  test("recusa chamada sem o segredo ou com id inválido", async () => {
    expect((await call("errado")).status).toBe(401);
    expect((await call("segredo", "../etc/passwd")).status).toBe(400);
    expect(sends.length).toBe(0);
  });

  test("respeita o desligar geral e o por categoria", async () => {
    data["prefs"] = [{ data: { gestor: { push: false } } }];
    expect(await (await call()).json()).toMatchObject({ sent: 0, reason: "preferências" });
    data["prefs"] = [{ data: { gestor: { push: true, payments: false } } }];
    expect(await (await call()).json()).toMatchObject({ sent: 0 });
    data["prefs"] = [{ data: { gestor: { push: true, payments: true } } }];
    expect(await (await call()).json()).toEqual({ sent: 2 });
  });

  test("a cliente usa as preferências dela, não as da gestora", async () => {
    data["profiles"] = [{ role: "cliente" }];
    data["prefs"] = [{ data: { gestor: { push: false }, cliente: { push: true } } }];
    expect(await (await call()).json()).toEqual({ sent: 2 });
  });

  test("aparelho que não existe mais sai da lista", async () => {
    fcmStatus["t-notebook"] = { status: 404, body: { error: { status: "NOT_FOUND" } } };
    expect(await (await call()).json()).toEqual({ sent: 1 });
    expect(deletes).toEqual(["t-notebook"]);
  });

  test("sem aparelho registrado não envia nada", async () => {
    data["push_tokens"] = [];
    expect(await (await call()).json()).toMatchObject({ sent: 0, reason: "sem aparelhos" });
  });
});

describe("regras puras", () => {
  test("tipos de aviso caem na categoria certa", () => {
    expect(categoryOf("bill")).toBe("payments");
    expect(categoryOf("payment")).toBe("payments");
    expect(categoryOf("stock")).toBe("stock");
    expect(categoryOf("recommendation")).toBe("recommendations");
    expect(categoryOf("request")).toBe("appointments");
  });
  test("padrão é receber", () => {
    expect(wantsPush(undefined, "gestor", "stock")).toBe(true);
    expect(wantsPush({}, "cliente", "reminder")).toBe(true);
  });
  test("mensagem corta textos longos e usa / quando não há destino", () => {
    const m = fcmMessage("t", { id: "i", title: "x".repeat(300), body: null, href: null }).message
      .data;
    expect(m.title.length).toBe(120);
    expect(m.href).toBe("/");
    expect(m.body).toBe("");
  });
  test("o token do Google é reaproveitado", async () => {
    resetTokenCache();
    tokenCalls = 0;
    await accessToken(account, fakeFetch, 1_000_000);
    await accessToken(account, fakeFetch, 1_000_000 + 60_000);
    expect(tokenCalls).toBe(1);
  });
});
