/**
 * Registro dos últimos erros inesperados do app neste aparelho (só texto, sem dados de clientes), para a pessoa
 * poder copiar e mandar ao suporte. Nada é enviado sozinho.
 */
const KEY = "eb.errors";
const LIMIT = 20;

export type LoggedError = { at: string; where: string; message: string; stack?: string };

export function logClientError(where: string, error: unknown) {
  try {
    const e = error as { message?: string; stack?: string } | null;
    const entry: LoggedError = {
      at: new Date().toISOString(),
      where: `${where} ${typeof location === "undefined" ? "" : location.pathname}`.trim(),
      message: String(e?.message ?? error).slice(0, 300),
      ...(e?.stack ? { stack: e.stack.split("\n").slice(0, 4).join("\n").slice(0, 400) } : {}),
    };
    const list = [entry, ...readErrors()].slice(0, LIMIT);
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignorado */
  }
}

export function readErrors(): LoggedError[] {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as LoggedError[];
  } catch {
    return [];
  }
}

/** Texto para copiar e enviar ao suporte. */
export function diagnosticsText(): string {
  const agent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const online = typeof navigator === "undefined" ? "" : String(navigator.onLine);
  return [
    `EstetBoost. diagnóstico`,
    `Agora: ${new Date().toISOString()}`,
    `Navegador: ${agent}`,
    `Online: ${online}`,
    "",
    ...readErrors().map(
      (entry) =>
        `${entry.at} · ${entry.where}\n${entry.message}${entry.stack ? `\n${entry.stack}` : ""}`,
    ),
  ].join("\n");
}

/** Liga os registros automáticos de erro da página. */
export function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (event) => logClientError("erro", event.error ?? event.message));
  window.addEventListener("unhandledrejection", (event) =>
    logClientError("promessa", event.reason),
  );
}
