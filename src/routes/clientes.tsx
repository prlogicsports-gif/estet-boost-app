import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/shell/app-shell";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — EstetBoost." },
      { name: "description", content: "Histórico, anamneses e evolução de cada cliente do seu estúdio." },
      { property: "og:title", content: "Clientes — EstetBoost." },
      { property: "og:description", content: "Histórico, anamneses e evolução de cada cliente do seu estúdio." },
    ],
  }),
  component: () => <AppShell title="Clientes" subtitle="Histórico, anamneses e evolução." />,
});
