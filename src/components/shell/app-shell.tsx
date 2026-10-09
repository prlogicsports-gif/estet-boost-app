import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";

import { RoleGate } from "@/components/auth/role-gate";
import { NotificationsPanel } from "@/components/eb/notifications-panel";
import { BottomSheet, Drawer } from "@/components/eb/overlays";
import { DesktopSidebar } from "@/components/shell/desktop-sidebar";
import { MobileDock } from "@/components/shell/mobile-dock";
import type { NavConfig } from "@/components/shell/nav-items";
import { ShellContext } from "@/components/shell/shell-context";
import { useVisibleNav } from "@/components/shell/use-visible-nav";
import { notificationsDb } from "@/data/db";
import { ToastHost } from "@/components/eb/toast";
import { useSyncReady } from "@/lib/remote-store";
import { useMediaQuery } from "@/lib/use-media-query";
import { useSession } from "@/lib/session";
import { runReminders } from "@/services/reminders";
import { notificationsFor } from "@/services/notify";

/**
 * Uma casca para os dois perfis: dock flutuante no celular e barra lateral no
 * desktop, as mesmas rotas nos dois. Só deixa passar o perfil indicado e roda as
 * regras de lembrete enquanto o app está aberto.
 */
export function AppShell({ nav: fullNav, children }: { nav: NavConfig; children: ReactNode }) {
  const nav = useVisibleNav(fullNav);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const session = useSession();
  const wide = useMediaQuery("(min-width: 1024px)");
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const all = notificationsDb.use();
  const items = useMemo(
    () => notificationsFor(all, nav.role, session?.clientId),
    [all, nav.role, session?.clientId],
  );
  const unread = items.filter((item) => !item.read).length;
  const ready = useSyncReady();
  const [syncError, setSyncError] = useState<string | null>(null);

  // Avisos de gravação recusada (sem permissão, horário ocupado…) aparecem para a pessoa.
  useEffect(() => {
    const onError = (event: Event) => {
      setSyncError((event as CustomEvent<string>).detail);
      window.setTimeout(() => setSyncError(null), 4000);
    };
    window.addEventListener("eb:sync-error", onError);
    return () => window.removeEventListener("eb:sync-error", onError);
  }, []);

  // Lembretes rodam depois que os dados chegaram e a tela já apareceu (nunca no meio da troca de tela).
  useEffect(() => {
    if (!ready) return;
    const first = window.setTimeout(() => runReminders(), 1500);
    const timer = window.setInterval(() => runReminders(), 60000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [ready]);

  // Depois que a primeira tela aparece, baixa em segundo plano o código de TODAS as telas do perfil,
  // para nenhum clique (menu ou botão) precisar esperar download.
  const router = useRouter();
  useEffect(() => {
    const targets =
      nav.role === "gestor"
        ? [
            { to: "/hoje" },
            { to: "/agenda" },
            { to: "/clientes" },
            { to: "/gestao" },
            { to: "/notificacoes" },
            { to: "/credenciais" },
            { to: "/configuracoes" },
            { to: "/atendimento/novo" },
            { to: "/clientes/$clientId", params: { clientId: "x" } },
            { to: "/atendimentos/$appointmentId", params: { appointmentId: "x" } },
            { to: "/atendimento/$sessionId", params: { sessionId: "x" } },
          ]
        : [
            { to: "/cliente" },
            { to: "/cliente/agenda" },
            { to: "/cliente/evolucao" },
            { to: "/cliente/perfil" },
          ];
    const handle = window.setTimeout(async () => {
      for (const target of targets) {
        await router.preloadRoute(target as never).catch(() => {});
        await new Promise((resolve) => window.setTimeout(resolve, 150));
      }
    }, 1200);
    return () => window.clearTimeout(handle);
  }, [router, nav.role]);

  const panel = (
    <NotificationsPanel
      items={items}
      audience={nav.role}
      clientId={session?.clientId}
      onOpen={(href) => {
        setOpen(false);
        navigate({ to: href });
      }}
    />
  );
  const subtitle =
    unread === 0 ? "Tudo em dia" : unread === 1 ? "1 não lida" : `${unread} não lidas`;

  return (
    <RoleGate role={nav.role}>
      {!ready ? (
        <div className="grid min-h-screen place-items-center bg-background" aria-busy>
          <span className="text-sm text-muted-foreground">Carregando seus dados…</span>
        </div>
      ) : null}
      <ShellContext.Provider value={{ openNotifications: () => setOpen(true), unread }}>
        <div className="min-h-screen bg-background" hidden={!ready}>
          <div
            className="mx-auto flex w-full gap-6 px-4 py-6 lg:px-8"
            style={{
              maxWidth:
                nav.role === "gestor"
                  ? "calc(var(--content-max, 1120px) + 236px + 64px)"
                  : undefined,
            }}
          >
            <DesktopSidebar nav={nav} />
            <main
              className="mx-auto min-w-0 flex-1 pb-32 lg:pb-6"
              style={{ maxWidth: nav.maxWidth }}
            >
              <div key={pathname} style={{ animation: "page-in 180ms ease-out" }}>
                {children}
              </div>
            </main>
          </div>
          <MobileDock nav={nav} />
        </div>

        {wide ? (
          <Drawer
            open={open}
            onClose={() => setOpen(false)}
            title="Notificações"
            subtitle={subtitle}
          >
            {panel}
          </Drawer>
        ) : (
          <BottomSheet
            tall
            open={open}
            onClose={() => setOpen(false)}
            title="Notificações"
            subtitle={subtitle}
            className="bg-[rgba(46,35,41,.84)]"
          >
            {panel}
          </BottomSheet>
        )}
      </ShellContext.Provider>
      <ToastHost toast={syncError ? { message: syncError } : null} />
    </RoleGate>
  );
}
