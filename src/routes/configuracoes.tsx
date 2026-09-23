import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/shell/app-shell";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — EstetBoost." },
      { name: "description", content: "Ajuste seu perfil, horários de atendimento e preferências do estúdio." },
      { property: "og:title", content: "Configurações — EstetBoost." },
      { property: "og:description", content: "Ajuste seu perfil, horários de atendimento e preferências do estúdio." },
    ],
  }),
  component: () => <AppShell title="Configurações" subtitle="Perfil, atendimento e preferências." />,
});
