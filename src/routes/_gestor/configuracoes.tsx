import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Icon } from "@/components/eb/icon";
import { TopBar } from "@/components/eb/top-bar";
import { NotificationPrefsEditor } from "@/components/eb/notifications-panel";
import { resetDemoData } from "@/data/db";
import { usePro } from "@/lib/use-pro";
import { authService } from "@/services/auth.service";

export const Route = createFileRoute("/_gestor/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — EstetBoost." },
      {
        name: "description",
        content: "Ajuste seu perfil, horários de atendimento e preferências do estúdio.",
      },
      { property: "og:title", content: "Configurações — EstetBoost." },
      {
        property: "og:description",
        content: "Ajuste seu perfil, horários de atendimento e preferências do estúdio.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

const items: [string, string, string][] = [
  ["Clock", "Horários de atendimento", "Dias e horários livres na agenda"],
  ["Sparkles", "Procedimentos e valores", "Duração, preço e retorno sugerido"],
  ["FileText", "Modelos de anamnese", "Perguntas de cada etapa"],
  ["ShieldCheck", "Consentimentos e autorizações", "Termos e autorização de imagem"],
  ["Bell", "Notificações", "Lembretes e avisos"],
];

const row =
  "flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-2 text-left";

function ConfiguracoesPage() {
  const pro = usePro();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-4">
      <TopBar title="Configurações" context={pro.name} user={pro} />
      <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
        Avisos
      </span>
      <NotificationPrefsEditor audience="gestor" />
      <span className="mt-2 text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
        Estúdio
      </span>
      <div className="flex flex-col gap-2">
        {items.map(([icon, title, detail]) => (
          <button key={title} type="button" className={row}>
            <Icon name={icon} size={18} color="var(--eb-nude-300)" />
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px]">{title}</span>
              <span className="block text-xs text-muted-foreground">{detail}</span>
            </span>
            <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
          </button>
        ))}
        <button
          type="button"
          className={row}
          onClick={() => {
            if (
              window.confirm(
                "Voltar clientes, agenda, caixa e avisos aos dados de exemplo? O que você criou será apagado.",
              )
            )
              resetDemoData();
          }}
        >
          <Icon name="RotateCcw" size={18} color="var(--eb-nude-300)" />
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px]">Restaurar dados de exemplo</span>
            <span className="block text-xs text-muted-foreground">
              Enquanto o app não tem banco, tudo fica neste aparelho
            </span>
          </span>
        </button>
        <button
          type="button"
          className={`${row} text-[var(--eb-coral-500)]`}
          onClick={() => {
            authService.signOut();
            navigate({ to: "/" });
          }}
        >
          <Icon name="LogOut" size={18} color="var(--eb-coral-500)" />
          <span className="flex-1 text-[14.5px]">Sair da conta</span>
        </button>
      </div>
    </div>
  );
}
