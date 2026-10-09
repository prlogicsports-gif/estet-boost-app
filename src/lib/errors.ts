/**
 * Protocolo de erros do app: todo erro de rede ou do banco cai numa destas classes, e cada classe tem UM
 * comportamento (ver docs/OFFLINE-E-ERROS.md). Assim nenhuma alteração se perde em silêncio.
 *
 *  rede        sem internet / servidor inalcançável → fica na fila do aparelho e reenvia sozinho
 *  sessao      login expirado ou revogado           → tenta renovar; se não der, pede para entrar de novo (fila preservada)
 *  servidor    erro 5xx / indisponível              → fila com novas tentativas espaçadas; depois de 5, vai para "Pendências"
 *  permissao   o banco recusou (RLS, 403)           → desfaz na tela e avisa; vai para "Pendências"
 *  conflito    registro repetido ou ocupado (409)   → desfaz na tela e avisa; vai para "Pendências"
 *  invalido    dado recusado (campo/obrigatório)    → desfaz na tela e avisa; vai para "Pendências"
 *  banco       tabela/coluna/função não existe      → o banco do Supabase está desatualizado (faltam migrações); vai para "Pendências"
 *  desconhecido qualquer outro                      → tratado como servidor
 */
export type ErrorClass =
  "rede" | "sessao" | "servidor" | "permissao" | "conflito" | "invalido" | "banco" | "desconhecido";

type Loose =
  | { message?: string; code?: string | number; status?: number; details?: string }
  | null
  | undefined;

export function classifyError(
  error: unknown,
  online = typeof navigator === "undefined" || navigator.onLine !== false,
): ErrorClass {
  const e = (error ?? {}) as Loose;
  const message = String(e?.message ?? error ?? "").toLowerCase();
  const code = String(e?.code ?? "");
  const status = Number(e?.status ?? 0);

  if (!online) return "rede";
  if (
    /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|timed out|err_internet|econn|enotfound/.test(
      message,
    )
  )
    return "rede";
  if (
    /^(PGRST20[245]|42703|42P01|42883)$/.test(code) ||
    /could not find the .* column|could not find the table|schema cache/.test(message)
  )
    return "banco";
  if (
    status === 401 ||
    /jwt|token.*expired|not authenticated|invalid claim/.test(message) ||
    code === "PGRST301"
  )
    return "sessao";
  if (
    code === "42501" ||
    status === 403 ||
    /row-level security|permission denied|violates row-level/.test(message)
  )
    return "permissao";
  if (
    code === "23505" ||
    code === "23P01" ||
    status === 409 ||
    /duplicate key|already exists|conflict/.test(message)
  )
    return "conflito";
  if (
    code === "23503" ||
    code === "23502" ||
    code === "23514" ||
    code.startsWith("22") ||
    status === 400 ||
    status === 422 ||
    /violates|invalid input|null value/.test(message)
  )
    return "invalido";
  if (status >= 500 || /service unavailable|bad gateway|internal/.test(message)) return "servidor";
  return "desconhecido";
}

/** Erros que valem nova tentativa depois (a alteração continua na fila). */
export const isRetryable = (kind: ErrorClass) =>
  kind === "rede" || kind === "sessao" || kind === "servidor" || kind === "desconhecido";

const HUMAN: Record<ErrorClass, string> = {
  rede: "Sem internet. A alteração ficou guardada neste aparelho e será enviada sozinha.",
  sessao: "Sua sessão expirou. Entre de novo: o que você fez está guardado e será enviado.",
  servidor: "O servidor está indisponível. Vamos tentar de novo em instantes.",
  permissao: "Você não tem permissão para essa alteração.",
  conflito: "Esse registro já existe ou o horário foi ocupado por outra pessoa.",
  invalido: "O servidor não aceitou os dados dessa alteração.",
  banco:
    "O banco de dados do Supabase está desatualizado (faltam migrações). Aplique as migrações pendentes e toque em Tentar de novo.",
  desconhecido: "Algo deu errado. Vamos tentar de novo.",
};

export const humanError = (kind: ErrorClass) => HUMAN[kind];

/** Espera (ms) antes da tentativa número `attempt` (1, 2, 3…): 5 s, 15 s, 45 s, 2 min, depois 5 min. */
export const backoff = (attempt: number) =>
  [5_000, 15_000, 45_000, 120_000, 300_000][Math.min(attempt, 5) - 1] ?? 300_000;
