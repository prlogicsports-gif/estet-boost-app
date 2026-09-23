import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/shell/app-shell";

export const Route = createFileRoute("/credenciais")({
  head: () => ({
    meta: [
      { title: "Credenciais — EstetBoost." },
      { name: "description", content: "Registros profissionais, documentos e consentimentos do seu estúdio." },
      { property: "og:title", content: "Credenciais — EstetBoost." },
      { property: "og:description", content: "Registros profissionais, documentos e consentimentos do seu estúdio." },
    ],
  }),
  component: () => <AppShell title="Credenciais" subtitle="Registros, documentos e consentimentos." />,
});
