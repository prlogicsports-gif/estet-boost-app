import type { ReactNode } from "react";

import { RoleGate } from "@/components/auth/role-gate";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { BrandMark } from "@/components/brand/brand-mark";
import { DesktopSidebar } from "@/components/shell/desktop-sidebar";
import { MobileDock } from "@/components/shell/mobile-dock";

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <RoleGate role="gestor">
      <div className="min-h-screen bg-background">
        <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6 lg:px-6">
          <DesktopSidebar />

          <main className="min-w-0 flex-1 pb-32 lg:pb-6">
            <div className="mb-6 lg:hidden">
              <span className="text-lg">
                <BrandMark />
              </span>
            </div>

            <header className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-light text-foreground">{title}</h1>
                {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
              </div>
              <SignOutButton />
            </header>

            {children ?? (
              <div className="rounded-[var(--radius-xl)] border border-border bg-[var(--card)] p-6 text-sm text-muted-foreground">
                Esta tela chega na próxima etapa.
              </div>
            )}
          </main>
        </div>

        <MobileDock />
      </div>
    </RoleGate>
  );
}
