import { createFileRoute } from "@tanstack/react-router";

import { ClientInvite } from "@/components/eb/client-invite";
import { TopBar } from "@/components/eb/top-bar";
import { useClinic } from "@/lib/use-clinic";
import { usePro } from "@/lib/use-pro";

export const Route = createFileRoute("/_gestor/credenciais")({
  head: () => ({
    meta: [
      { title: "Credenciais — EstetBoost." },
      {
        name: "description",
        content: "Convide novas clientes com o seu link fixo ou com uma credencial de uso único.",
      },
      { property: "og:title", content: "Credenciais — EstetBoost." },
      {
        property: "og:description",
        content: "Convide novas clientes com o seu link fixo ou com uma credencial de uso único.",
      },
    ],
  }),
  component: CredenciaisPage,
});

function CredenciaisPage() {
  const pro = usePro();
  const { clinic } = useClinic();
  return (
    <div className="flex flex-col gap-4">
      <TopBar
        title="Credenciais"
        context={clinic?.name ?? "Cadastro de novas clientes"}
        user={pro}
      />
      {clinic ? <ClientInvite clinic={clinic} /> : null}
    </div>
  );
}
