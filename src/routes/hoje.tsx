import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/shell/app-shell";

export const Route = createFileRoute("/hoje")({
  head: () => ({
    meta: [
      { title: "Hoje — EstetBoost." },
      { name: "description", content: "Veja os atendimentos do dia e o que precisa da sua atenção agora." },
      { property: "og:title", content: "Hoje — EstetBoost." },
      { property: "og:description", content: "Veja os atendimentos do dia e o que precisa da sua atenção agora." },
    ],
  }),
  component: () => <AppShell title="Hoje" subtitle="Seus atendimentos e lembretes do dia." />,
});
