import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { Icon } from "@/components/eb/icon";
import { Drawer } from "@/components/eb/overlays";
import { Button } from "@/components/ui/button";
import {
  discardFailed,
  flushAll,
  retryFailed,
  useSyncLists,
  useSyncStatus,
} from "@/lib/remote-store";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Faixa discreta no topo com o estado da conexão e a fila: sem internet, enviando, alterações que o servidor
 * não aceitou ("Pendências") e sessão expirada. Nada fica em silêncio.
 */
export function SyncStatusBar() {
  const status = useSyncStatus();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const message = status.authExpired
    ? {
        tone: "bad",
        icon: "KeyRound",
        text: `Sessão expirada. ${plural(status.pending, "alteração guardada", "alterações guardadas")}`,
        action: "Entrar de novo",
      }
    : status.failed
      ? {
          tone: "bad",
          icon: "AlertTriangle",
          text: plural(status.failed, "alteração não aceita", "alterações não aceitas"),
          action: "Ver",
        }
      : !status.online
        ? {
            tone: "warn",
            icon: "WifiOff",
            text: status.pending
              ? `Sem internet · ${plural(status.pending, "alteração guardada", "alterações guardadas")} aqui`
              : "Sem internet · você pode continuar usando",
            action: status.pending ? "Ver" : "",
          }
        : status.pending
          ? {
              tone: "info",
              icon: "RefreshCw",
              text: `Enviando ${plural(status.pending, "alteração", "alterações")}…`,
              action: "Ver",
            }
          : null;

  return (
    <>
      {message ? (
        <div
          className="pointer-events-none fixed inset-x-0 z-[95] flex justify-center px-3"
          style={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
          role="status"
          aria-live="polite"
        >
          <div
            className={cn(
              "pointer-events-auto flex max-w-full items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] shadow-lg backdrop-blur-md",
              message.tone === "bad" &&
                "border-[rgba(201,109,109,.5)] bg-[rgba(60,30,34,.92)] text-foreground",
              message.tone === "warn" &&
                "border-[rgba(216,166,83,.45)] bg-[rgba(58,46,28,.92)] text-foreground",
              message.tone === "info" &&
                "border-[var(--eb-teal-a40)] bg-[rgba(28,48,48,.92)] text-foreground",
            )}
          >
            <Icon name={message.icon} size={14} />
            <span className="min-w-0 truncate">{message.text}</span>
            {message.action ? (
              <button
                type="button"
                className="min-h-8 flex-none rounded-full px-2 font-medium text-[var(--teal)]"
                onClick={async () => {
                  if (status.authExpired) {
                    await supabase.auth.signOut({ scope: "local" }); // a fila fica guardada; ao entrar de novo, ela segue
                    navigate({ to: "/" });
                  } else setOpen(true);
                }}
              >
                {message.action}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <PendingDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function PendingDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const lists = useSyncLists();
  const status = useSyncStatus();
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Pendências"
      subtitle="O que ainda não chegou ao servidor"
      width={460}
    >
      <div className="flex flex-col gap-3">
        {lists.failed.length ? (
          <>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Não aceitas pelo servidor
            </span>
            {lists.failed.map((entry) => (
              <div
                key={entry.item.seq}
                className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[rgba(201,109,109,.35)] bg-[var(--surface-card)] p-3.5"
              >
                <div className="text-[14px] font-medium">{entry.item.label}</div>
                <p className="text-[12.5px] text-[var(--text-secondary)]">{entry.message}</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => retryFailed(entry.item.seq)}
                  >
                    Tentar de novo
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => discardFailed(entry.item.seq)}
                  >
                    Descartar
                  </Button>
                </div>
              </div>
            ))}
          </>
        ) : null}

        {lists.pending.length ? (
          <>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Aguardando envio
            </span>
            {lists.pending.map((item) => (
              <div
                key={item.seq}
                className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-3"
              >
                <span className="min-w-0 flex-1 text-[13.5px]">
                  <span className="block truncate">{item.label}</span>
                  {item.last ? (
                    <span className="block text-[11.5px] text-muted-foreground">{item.last}</span>
                  ) : null}
                </span>
                <span className="font-mono text-[11.5px] text-muted-foreground">
                  {item.attempts ? `${item.attempts}ª tentativa` : "na fila"}
                </span>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="self-start"
              disabled={!status.online}
              onClick={() => void flushAll()}
            >
              <Icon name="RefreshCw" size={15} /> Enviar agora
            </Button>
            {!status.online ? (
              <p className="text-xs text-muted-foreground">
                Sem internet no momento. O envio acontece sozinho quando a conexão voltar.
              </p>
            ) : null}
          </>
        ) : null}

        {!lists.failed.length && !lists.pending.length ? (
          <p className="text-[13px] text-muted-foreground">Tudo enviado. Nada pendente.</p>
        ) : null}
      </div>
    </Drawer>
  );
}
