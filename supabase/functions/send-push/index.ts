/**
 * Edge Function `send-push` (Supabase, Deno). Envia o push (Firebase Cloud Messaging) de UM aviso novo.
 * Quem chama é o gatilho do banco (`app.push_on_notification`), com o cabeçalho secreto `x-push-secret`.
 *
 * Secrets da função (Supabase → Edge Functions → Secrets):
 *   PUSH_SECRET          texto longo e aleatório (o mesmo guardado em app.secrets 'push_secret')
 *   FCM_SERVICE_ACCOUNT  o JSON inteiro da conta de serviço do Firebase (nunca no navegador, nunca no repositório)
 * SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem automaticamente na função.
 * Desligue "Verify JWT" desta função: ela se protege pelo x-push-secret.
 *
 * Arquivo único e sem importações de propósito: dá para colar no editor do painel e é testável fora do Deno.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

export type Env = { url: string; serviceKey: string; pushSecret: string; serviceAccount: string };
type Fetch = typeof fetch;
type Prefs = Record<string, Record<string, boolean> | undefined>;

/** Categoria de preferência de cada tipo de aviso (mesma lógica de Configurações → Avisos). */
export function categoryOf(
  kind: string,
): "appointments" | "payments" | "stock" | "recommendations" {
  if (kind === "bill" || kind === "payment") return "payments";
  if (kind === "stock") return "stock";
  if (kind === "recommendation") return "recommendations";
  return "appointments";
}

/** Nome do tipo de aviso que abre o título do push ("Agenda · Seu atendimento é hoje"). */
export function labelOf(kind: string, role: string): string {
  const client = role === "cliente";
  if (kind === "bill" || kind === "payment") return client ? "Pagamento" : "Financeiro";
  if (kind === "stock") return "Estoque";
  if (kind === "recommendation") return client ? "Cuidados" : "Clientes";
  if (kind === "followup") return client ? "Seu cuidado" : "Clientes";
  return "Agenda";
}

/** A pessoa quer receber push deste aviso? (liga/desliga geral e por categoria; o padrão é receber) */
export function wantsPush(prefs: Prefs | null | undefined, role: string, kind: string): boolean {
  const mine = prefs?.[role === "cliente" ? "cliente" : "gestor"];
  if (!mine) return true;
  if (mine["push"] === false) return false;
  return mine[categoryOf(kind)] !== false;
}

const b64url = (input: ArrayBuffer | string) => {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

type ServiceAccount = { client_email: string; private_key: string; project_id: string };
let cached: { token: string; until: number } | null = null;

/** Token de acesso do Google (OAuth2) a partir da conta de serviço: JWT assinado com RS256. */
export async function accessToken(
  account: ServiceAccount,
  doFetch: Fetch,
  nowMs = Date.now(),
): Promise<string> {
  if (cached && cached.until > nowMs + 60_000) return cached.token;
  const iat = Math.floor(nowMs / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat,
      exp: iat + 3600,
    }),
  );
  const pem = account.private_key.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const response = await doFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64url(signature)}`,
    }),
  });
  if (!response.ok) throw new Error(`token ${response.status}`);
  const body = (await response.json()) as { access_token: string; expires_in: number };
  cached = { token: body.access_token, until: nowMs + body.expires_in * 1000 };
  return body.access_token;
}

export const resetTokenCache = () => {
  cached = null;
};

/** Mensagem só de dados: quem desenha a notificação é o service worker do app (`public/sw.js`). */
export function fcmMessage(
  token: string,
  n: { id: string; title: string; body: string | null; href: string | null; kind?: string },
  opts: { role?: string; unread?: number } = {},
) {
  const label = n.kind ? labelOf(n.kind, opts.role ?? "gestor") : "";
  return {
    message: {
      token,
      data: {
        title: (label ? `${label} · ${n.title}` : n.title).slice(0, 120),
        body: (n.body ?? "").slice(0, 240),
        href: n.href ?? "/",
        tag: n.id,
        unread: String(Math.max(0, opts.unread ?? 0)),
      },
      webpush: { headers: { Urgency: "high", TTL: "86400" } },
    },
  };
}

const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export async function handle(req: Request, env: Env, doFetch: Fetch): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "método" }, 405);
  if (!env.pushSecret || !safeEqual(req.headers.get("x-push-secret") ?? "", env.pushSecret))
    return json({ error: "não autorizado" }, 401);

  let id = "";
  try {
    id = String(((await req.json()) as { id?: string }).id ?? "");
  } catch {
    return json({ error: "corpo inválido" }, 400);
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "id inválido" }, 400);

  const headers = { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}` };
  const get = async <T>(path: string): Promise<T[]> => {
    const response = await doFetch(`${env.url}/rest/v1/${path}`, { headers });
    return response.ok ? ((await response.json()) as T[]) : [];
  };

  const [n] = await get<{
    id: string;
    recipient_id: string;
    kind: string;
    title: string;
    body: string | null;
    href: string | null;
  }>(`notifications?id=eq.${id}&select=id,recipient_id,kind,title,body,href`);
  if (!n) return json({ sent: 0, reason: "aviso não encontrado" });
  const [profile] = await get<{ role: string }>(`profiles?id=eq.${n.recipient_id}&select=role`);
  const [prefs] = await get<{ data: Prefs }>(`prefs?user_id=eq.${n.recipient_id}&select=data`);
  if (!wantsPush(prefs?.data, profile?.role ?? "gestor", n.kind))
    return json({ sent: 0, reason: "preferências" });
  const tokens = await get<{ token: string }>(
    `push_tokens?user_id=eq.${n.recipient_id}&select=token`,
  );
  if (!tokens.length) return json({ sent: 0, reason: "sem aparelhos" });
  // quantos avisos não lidos a pessoa tem (vira o número no ícone do app)
  const unread = (
    await get<{ id: string }>(
      `notifications?recipient_id=eq.${n.recipient_id}&read=eq.false&select=id&limit=99`,
    )
  ).length;
  const opts = { role: profile?.role ?? "gestor", unread };

  const account = JSON.parse(env.serviceAccount) as ServiceAccount;
  const bearer = await accessToken(account, doFetch);
  let sent = 0;
  for (const { token } of tokens) {
    const response = await doFetch(
      `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
        body: JSON.stringify(fcmMessage(token, n, opts)),
      },
    );
    if (response.ok) {
      sent += 1;
      continue;
    }
    // aparelho que desinstalou ou trocou de token: sai da lista
    const error = ((await response.json().catch(() => ({}))) as { error?: { status?: string } })
      .error;
    if (
      response.status === 404 ||
      error?.status === "NOT_FOUND" ||
      error?.status === "UNREGISTERED" ||
      error?.status === "INVALID_ARGUMENT"
    ) {
      await doFetch(`${env.url}/rest/v1/push_tokens?token=eq.${encodeURIComponent(token)}`, {
        method: "DELETE",
        headers,
      });
    }
  }
  return json({ sent });
}

if (typeof Deno !== "undefined" && typeof Deno.serve === "function") {
  Deno.serve((req: Request) =>
    handle(
      req,
      {
        url: Deno.env.get("SUPABASE_URL") ?? "",
        serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        pushSecret: Deno.env.get("PUSH_SECRET") ?? "",
        serviceAccount: Deno.env.get("FCM_SERVICE_ACCOUNT") ?? "{}",
      },
      fetch,
    ),
  );
}
