import { useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { NotificationsPanel } from "@/components/eb/notifications-panel";
import { TopBar } from "@/components/eb/top-bar";
import { notificationsDb } from "@/data/db";
import { usePro } from "@/lib/use-pro";
import { notificationsFor } from "@/services/notify";

export const Route = createFileRoute("/_gestor/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — EstetBoost." },
      {
        name: "description",
        content: "Confirmações, lembretes e avisos do seu estúdio em um só lugar.",
      },
      { property: "og:title", content: "Notificações — EstetBoost." },
      {
        property: "og:description",
        content: "Confirmações, lembretes e avisos do seu estúdio em um só lugar.",
      },
    ],
  }),
  component: NotificacoesPage,
});

function NotificacoesPage() {
  const pro = usePro();
  const navigate = useNavigate();
  const all = notificationsDb.use();
  const items = useMemo(() => notificationsFor(all, "gestor"), [all]);
  const unread = items.filter((item) => !item.read).length;
  return (
    <div className="flex flex-col gap-4">
      <TopBar
        title="Notificações"
        context={unread ? `${unread} não lidas` : "Tudo em dia"}
        user={pro}
      />
      <NotificationsPanel
        items={items}
        audience="gestor"
        onOpen={(href) => navigate({ to: href })}
      />
    </div>
  );
}
