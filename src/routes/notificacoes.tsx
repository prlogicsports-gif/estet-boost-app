import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/shell/app-shell";

export const Route = createFileRoute("/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — EstetBoost." },
      { name: "description", content: "Confirmações, lembretes e avisos do seu estúdio em um só lugar." },
      { property: "og:title", content: "Notificações — EstetBoost." },
      { property: "og:description", content: "Confirmações, lembretes e avisos do seu estúdio em um só lugar." },
    ],
  }),
  component: () => <AppShell title="Notificações" subtitle="Confirmações, lembretes e avisos." />,
});
