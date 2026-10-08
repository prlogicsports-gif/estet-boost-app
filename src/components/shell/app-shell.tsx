import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { RoleGate } from "@/components/auth/role-gate";
import { NotificationsPanel } from "@/components/eb/notifications-panel";
import { BottomSheet, Drawer } from "@/components/eb/overlays";
import { DesktopSidebar } from "@/components/shell/desktop-sidebar";
import { MobileDock } from "@/components/shell/mobile-dock";
import type { NavConfig } from "@/components/shell/nav-items";
import { ShellContext } from "@/components/shell/shell-context";
import { notificationsDb } from "@/data/db";
import { useMediaQuery } from "@/lib/use-media-query";
import { useSession } from "@/lib/session";
import { runReminders } from "@/services/reminders";
import { notificationsFor } from "@/services/notify";

/**
 * Uma casca para os dois perfis: dock flutuante no celular e barra lateral no
 * desktop, as mesmas rotas nos dois. Só deixa passar o perfil indicado e roda as
 * regras de lembrete enquanto o app está aberto.
 */
export function AppShell({ nav, children }: { nav: NavConfig; children: ReactNode }) {
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

  useEffect(() => {
    runReminders();
    const timer = window.setInterval(() => runReminders(), 60000);
    return () => window.clearInterval(timer);
  }, []);

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
      <ShellContext.Provider value={{ openNotifications: () => setOpen(true), unread }}>
        <div className="min-h-screen bg-background">
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
              <div key={pathname} style={{ animation: "fade-up 320ms cubic-bezier(.16,1,.3,1)" }}>
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
    </RoleGate>
  );
}
