import { useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

import { RoleGate } from "@/components/auth/role-gate";
import { Button } from "@/components/ui/button";
import { NotificationCenter, type NotificationItem } from "@/components/eb/notification-center";
import { Drawer } from "@/components/eb/overlays";
import { DesktopSidebar } from "@/components/shell/desktop-sidebar";
import { MobileDock } from "@/components/shell/mobile-dock";
import type { NavConfig } from "@/components/shell/nav-items";
import { ShellContext } from "@/components/shell/shell-context";

/**
 * Uma casca para os dois perfis: dock flutuante no celular e barra lateral no
 * desktop, as mesmas rotas nos dois. Só deixa passar o perfil indicado.
 */
export function AppShell({
  nav,
  notifications,
  children,
}: {
  nav: NavConfig;
  notifications: NotificationItem[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const unread = notifications.filter((item) => item.unread).length;

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

        <Drawer
          open={open}
          onClose={() => setOpen(false)}
          title="Notificações"
          subtitle={unread === 1 ? "1 não lida" : `${unread} não lidas`}
          footer={
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => setOpen(false)}
            >
              Fechar
            </Button>
          }
        >
          <NotificationCenter items={notifications} onMarkAll={() => {}} />
        </Drawer>
      </ShellContext.Provider>
    </RoleGate>
  );
}
