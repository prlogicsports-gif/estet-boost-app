import { createFileRoute } from "@tanstack/react-router";

import { NotificationCenter } from "@/components/eb/notification-center";
import { TopBar } from "@/components/eb/top-bar";
import { notifications, pro } from "@/data/gestor-mock";

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
  const unread = notifications.filter((item) => item.unread).length;
  return (
    <div className="flex flex-col gap-4">
      <TopBar title="Notificações" context={`${unread} não lidas`} user={pro} />
      <NotificationCenter items={notifications} onMarkAll={() => {}} />
    </div>
  );
}
