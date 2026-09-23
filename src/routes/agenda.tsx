import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/shell/app-shell";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — EstetBoost." },
      { name: "description", content: "Organize horários, confirmações e retornos das suas clientes." },
      { property: "og:title", content: "Agenda — EstetBoost." },
      { property: "og:description", content: "Organize horários, confirmações e retornos das suas clientes." },
    ],
  }),
  component: () => <AppShell title="Agenda" subtitle="Horários, confirmações e retornos." />,
});
