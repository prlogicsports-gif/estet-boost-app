/**
 * Edge Function `create-client-account` (Supabase, Deno). A gestora (ou funcionária com permissão de clientes)
 * cria o acesso da cliente ao app: e-mail + senha, já confirmados, ligados à ficha. A cliente só abre o link e entra.
 * Também redefine a senha de acesso de uma cliente que já tem conta (`mode: "reset"`).
 *
 * Entrada (POST, Authorization: Bearer <login de quem chama>):
 *   { client_id, email, password, mode?: "create" | "reset" }
 * Saída (sempre 200): { ok: true } ou { ok: false, reason }.
 *
 * Só a chave de serviço (SUPABASE_SERVICE_ROLE_KEY, já existe na função) cria usuários; ela nunca vai ao navegador.
 * A senha só passa daqui para o Auth: não é gravada nem registrada em log.
 * Desligue "Verify JWT" desta função (ela mesma confere o login e responde ao pré-voo CORS).
 *
 * Arquivo único e sem importações de propósito: dá para colar no editor do painel e é testável fora do Deno.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

export type Env = { url: string; serviceKey: string };
type Fetch = typeof fetch;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HOURLY_LIMIT = 40;

export async function handle(req: Request, env: Env, doFetch: Fetch): Promise<Response> {
  const reply = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  const fail = (reason: string) => reply({ ok: false, reason });

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ ok: false, reason: "metodo" }, 405);

  const service = { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}` };
  const rest = async <T>(path: string): Promise<T[]> => {
    const response = await doFetch(`${env.url}/rest/v1/${path}`, { headers: service });
    return response.ok ? ((await response.json()) as T[]) : [];
  };

  // 1) quem chama
  const bearer = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+/i.test(bearer)) return fail("sem_login");
  const whoResponse = await doFetch(`${env.url}/auth/v1/user`, {
    headers: { apikey: env.serviceKey, Authorization: bearer },
  });
  if (!whoResponse.ok) return fail("sem_login");
  const who = (await whoResponse.json().catch(() => ({}))) as { id?: string };
  if (!who.id || !UUID.test(who.id)) return fail("sem_login");

  const [me] = await rest<{
    clinic_id: string;
    role: string;
    active: boolean;
    permissions: Record<string, unknown> | null;
  }>(`profiles?id=eq.${who.id}&select=clinic_id,role,active,permissions`);
  const allowed =
    me?.active &&
    (me.role === "gestor" || (me.role === "funcionario" && me.permissions?.["clientes"] === true));
  if (!me || !allowed) return fail("sem_permissao");

  // 2) o que foi pedido
  let body: { client_id?: string; email?: string; password?: string; mode?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return fail("dados_invalidos");
  }
  const mode = body.mode === "reset" ? "reset" : "create";
  const clientId = String(body.client_id ?? "");
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  if (!UUID.test(clientId)) return fail("dados_invalidos");
  if (!EMAIL.test(email) || email.length > 254) return fail("email_invalido");
  if (password.length < 8 || password.length > 72) return fail("senha_curta");

  // 3) a ficha precisa ser desta clínica
  const [client] = await rest<{
    id: string;
    clinic_id: string;
    user_id: string | null;
    name: string;
  }>(`clients?id=eq.${clientId}&select=id,clinic_id,user_id,name`);
  if (!client || client.clinic_id !== me.clinic_id) return fail("nao_encontrada");

  // 4) limite por clínica (criar contas é sensível)
  const since = new Date(Date.now() - 3600_000).toISOString();
  const recent = await rest<{ id: string }>(
    `activity?clinic_id=eq.${me.clinic_id}&text=like.Acesso%20ao%20app*&at=gte.${encodeURIComponent(since)}&select=id&limit=${HOURLY_LIMIT}`,
  );
  if (recent.length >= HOURLY_LIMIT) return fail("limite");

  const admin = { ...service, "Content-Type": "application/json" };
  const event = (p_mode: string, userId: string) =>
    doFetch(`${env.url}/rest/v1/rpc/client_access_event`, {
      method: "POST",
      headers: admin,
      body: JSON.stringify({
        p_mode,
        p_user: userId,
        p_client: client.id,
        p_email: email,
        p_actor: who.id,
        p_actor_role: me.role,
      }),
    });

  if (mode === "reset") {
    if (!client.user_id) return fail("sem_acesso");
    const [target] = await rest<{ clinic_id: string; role: string }>(
      `profiles?id=eq.${client.user_id}&select=clinic_id,role`,
    );
    if (!target || target.clinic_id !== me.clinic_id || target.role !== "cliente")
      return fail("nao_encontrada");
    const response = await doFetch(`${env.url}/auth/v1/admin/users/${client.user_id}`, {
      method: "PUT",
      headers: admin,
      body: JSON.stringify({ password }),
    });
    if (!response.ok) return fail("erro");
    await event("reset", client.user_id);
    return reply({ ok: true });
  }

  if (client.user_id) return fail("ja_tem_acesso");

  // 5) cria o usuário (e-mail já confirmado) e liga à ficha
  const created = await doFetch(`${env.url}/auth/v1/admin/users`, {
    method: "POST",
    headers: admin,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: client.name },
    }),
  });
  if (!created.ok) {
    const error = (await created.json().catch(() => ({}))) as {
      code?: string;
      error_code?: string;
      msg?: string;
      message?: string;
    };
    const text =
      `${error.error_code ?? error.code ?? ""} ${error.msg ?? error.message ?? ""}`.toLowerCase();
    if (/email_exists|already been registered|already registered/.test(text))
      return fail("email_em_uso");
    if (/weak_password|password/.test(text)) return fail("senha_curta");
    return fail("erro");
  }
  const user = (await created.json().catch(() => ({}))) as { id?: string };
  if (!user.id) return fail("erro");

  const linked = await event("create", user.id);
  const result = (linked.ok ? await linked.json().catch(() => null) : null) as {
    ok?: boolean;
    reason?: string;
  } | null;
  if (!result?.ok) {
    // não deixa conta solta sem ficha
    await doFetch(`${env.url}/auth/v1/admin/users/${user.id}`, {
      method: "DELETE",
      headers: service,
    });
    return fail(result?.reason ?? "erro");
  }
  return reply({ ok: true });
}

if (typeof Deno !== "undefined" && typeof Deno.serve === "function") {
  Deno.serve((req: Request) =>
    handle(
      req,
      {
        url: Deno.env.get("SUPABASE_URL") ?? "",
        serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      },
      fetch,
    ),
  );
}
