import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/shell/app-shell";

export const Route = createFileRoute("/gestao")({
  head: () => ({
    meta: [
      { title: "Gestão — EstetBoost." },
      { name: "description", content: "Acompanhe caixa, serviços e indicadores do seu negócio de estética." },
      { property: "og:title", content: "Gestão — EstetBoost." },
      { property: "og:description", content: "Acompanhe caixa, serviços e indicadores do seu negócio de estética." },
    ],
  }),
  component: () => <AppShell title="Gestão" subtitle="Caixa, serviços e indicadores." />,
});
