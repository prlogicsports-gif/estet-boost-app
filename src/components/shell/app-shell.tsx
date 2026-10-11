import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";

import { RoleGate } from "@/components/auth/role-gate";
import { NotificationsPanel } from "@/components/eb/notifications-panel";
import { NotificationBanner } from "@/components/eb/notification-banner";
import { PushPrompt } from "@/components/eb/push-prompt";
import { BottomSheet, Drawer } from "@/components/eb/overlays";
import { DesktopSidebar } from "@/components/shell/desktop-sidebar";
import { MobileDock } from "@/components/shell/mobile-dock";
import type { NavConfig } from "@/components/shell/nav-items";
import { ShellContext } from "@/components/shell/shell-context";
import { useVisibleNav } from "@/components/shell/use-visible-nav";
import { notificationsDb } from "@/data/db";
import { ToastHost } from "@/components/eb/toast";
import { InstallBanner } from "@/components/eb/install-app";
import { SyncStatusBar } from "@/components/shell/sync-status";
import { useSyncReady } from "@/lib/remote-store";
import { useMediaQuery } from "@/lib/use-media-query";
import { useSession } from "@/lib/session";
import { syncPushToken } from "@/services/push.service";
import { setAppBadge } from "@/lib/badge";
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

  // número no ícone do app = avisos não lidos
  useEffect(() => {
    setAppBadge(unread);
  }, [unread]);

  // toque numa notificação do aparelho com o app já aberto: o service worker pede para navegar aqui
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; href?: string } | null;
      if (data?.type === "eb:open" && typeof data.href === "string" && data.href.startsWith("/"))
        navigate({ to: data.href });
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [navigate]);
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

  // Se a pessoa já liberou o push, mantém o token do aparelho em dia (depois que a tela já apareceu).
  useEffect(() => {
    if (!ready) return;
    const handle = window.setTimeout(() => void syncPushToken(), 2500);
    return () => window.clearTimeout(handle);
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
            { to: "/catalogo" },
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
              <InstallBanner />
              <div key={pathname} style={{ animation: "page-in 320ms cubic-bezier(.22,1,.36,1)" }}>
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
      <SyncStatusBar />
      <NotificationBanner audience={nav.role} onOpen={(href) => navigate({ to: href })} />
      <PushPrompt audience={nav.role} ready={ready} />
      <ToastHost toast={syncError ? { message: syncError } : null} />
    </RoleGate>
  );
}
