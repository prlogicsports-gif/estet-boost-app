import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Icon } from "@/components/eb/icon";
import { Input } from "@/components/eb/input";
import { TopBar } from "@/components/eb/top-bar";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { client } from "@/data/cliente-mock";
import { authService } from "@/services/auth.service";

export const Route = createFileRoute("/cliente/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — EstetBoost." }] }),
  component: PerfilPage,
});

const label =
  "text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground";

function Row({
  title,
  detail,
  checked,
  onToggle,
}: {
  title: string;
  detail: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex min-h-14 items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5">
      <span className="flex-1">
        <span className="block text-sm">{title}</span>
        <span className="block text-[11.5px] text-muted-foreground">{detail}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label={title}
        className="size-5 accent-[var(--teal)]"
      />
    </label>
  );
}

function PerfilPage() {
  const navigate = useNavigate();
  const { openNotifications, unread } = useShell();
  const [image, setImage] = useState(true);
  const [push, setPush] = useState(true);
  const [whatsapp, setWhatsapp] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <TopBar
        title="Meu perfil"
        context="Dados, consentimentos e notificações"
        notifications={unread}
        user={client}
        onNotifications={openNotifications}
      />

      <div className="flex items-center gap-3.5">
        <span className="grid size-16 place-items-center rounded-full bg-[var(--eb-nude-a32)] text-[21px] font-medium">
          {client.initials}
        </span>
        <div>
          <div className="text-xl font-medium">{client.name}</div>
          <div className="text-[13px] text-[var(--text-secondary)]">34 anos · (11) 98844-1027</div>
        </div>
      </div>

      <span className={label}>Dados pessoais</span>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
        <Input label="Nome" defaultValue={client.name} />
        <Input label="Telefone" defaultValue="(11) 98844-1027" />
        <Input label="E-mail" defaultValue="mariana.silva@email.com" />
        <Input label="Data de nascimento" type="date" defaultValue="1992-04-18" />
      </div>

      <span className={label}>Preferências de notificação</span>
      <Row
        title="Lembretes de atendimento"
        detail="24 horas antes, no aplicativo"
        checked={push}
        onToggle={() => setPush((value) => !value)}
      />
      <Row
        title="Avisos por WhatsApp"
        detail="Confirmações e mudanças de horário"
        checked={whatsapp}
        onToggle={() => setWhatsapp((value) => !value)}
      />

      <span className={label}>Consentimentos</span>
      <Row
        title="Autorização de imagem"
        detail="Uso interno das fotografias de evolução"
        checked={image}
        onToggle={() => setImage((value) => !value)}
      />
      <div className="rounded-[var(--radius-md)] border border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] px-4 py-3.5 text-[12.5px] text-[var(--text-secondary)]">
        Termo de consentimento assinado em 02 de junho de 2026. Você pode revogar a autorização de
        imagem a qualquer momento.
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          authService.signOut();
          navigate({ to: "/" });
        }}
      >
        <Icon name="LogOut" size={18} /> Sair da conta
      </Button>
    </div>
  );
}
