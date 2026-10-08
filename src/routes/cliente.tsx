import { createFileRoute } from "@tanstack/react-router";

import { RoleGate } from "@/components/auth/role-gate";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { BrandMark } from "@/components/brand/brand-mark";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/cliente")({
  head: () => ({
    meta: [
      { title: "Sua área — EstetBoost." },
      {
        name: "description",
        content: "Acompanhe seus horários, sua evolução e as recomendações da sua esteticista.",
      },
      { property: "og:title", content: "Sua área — EstetBoost." },
      {
        property: "og:description",
        content: "Acompanhe seus horários, sua evolução e as recomendações da sua esteticista.",
      },
    ],
  }),
  component: ClienteHome,
});

function ClienteHome() {
  const session = useSession();
  return (
    <RoleGate role="cliente">
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <div className="mb-8 flex items-center justify-between">
          <span className="text-lg">
            <BrandMark />
          </span>
          <SignOutButton />
        </div>
        <h1 className="text-2xl font-light text-foreground">Olá, {session?.name.split(" ")[0]}.</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seus horários e sua evolução aparecem aqui.
        </p>
        <div className="mt-6 rounded-[var(--radius-xl)] border border-border bg-[var(--card)] p-6 text-sm text-muted-foreground">
          Esta tela chega na próxima etapa.
        </div>
      </div>
    </RoleGate>
  );
}
