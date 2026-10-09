import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Icon } from "@/components/eb/icon";
import { Input } from "@/components/eb/input";
import { NotificationPrefsEditor } from "@/components/eb/notifications-panel";
import { ToastHost } from "@/components/eb/toast";
import { TopBar } from "@/components/eb/top-bar";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { clientsDb } from "@/data/db";
import { useClient } from "@/lib/use-client";
import { useClinic } from "@/lib/use-clinic";
import { updateClient } from "@/services/clients.service";
import { authService } from "@/services/auth.service";

export const Route = createFileRoute("/cliente/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — EstetBoost." }] }),
  component: PerfilPage,
});

const label =
  "text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground";

function PerfilPage() {
  const navigate = useNavigate();
  const { openNotifications, unread } = useShell();
  const { clientId, client, profile } = useClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birth, setBirth] = useState("");
  const [address, setAddress] = useState("");
  const [goal, setGoal] = useState("");
  const [allergies, setAllergies] = useState("");
  const { clinic } = useClinic();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setName(client?.name ?? profile.name);
    setPhone(client?.phone ?? "");
    setEmail(client?.email ?? "");
    setBirth(client?.birth ?? "");
    setAddress(client?.address ?? "");
    setGoal(client?.goal ?? "");
    setAllergies(client?.allergies ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    clientId,
    client?.name,
    client?.phone,
    client?.email,
    client?.birth,
    client?.address,
    client?.goal,
    client?.allergies,
  ]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const consent = client?.imageConsent ?? true;
  const dirty =
    name !== (client?.name ?? "") ||
    phone !== (client?.phone ?? "") ||
    email !== (client?.email ?? "") ||
    birth !== (client?.birth ?? "") ||
    address !== (client?.address ?? "") ||
    goal !== (client?.goal ?? "") ||
    allergies !== (client?.allergies ?? "");

  function save() {
    if (!name.trim()) return;
    updateClient(clientId, {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase() || undefined,
      birth: birth || undefined,
      address: address.trim() || undefined,
      goal: goal.trim() || undefined,
      allergies: allergies.trim() || undefined,
    });
    setToast("Dados salvos");
  }

  return (
    <div className="flex flex-col gap-4">
      <TopBar
        title="Meu perfil"
        context="Dados, consentimentos e notificações"
        notifications={unread}
        user={profile}
        onNotifications={openNotifications}
      />

      <div className="flex items-center gap-3.5">
        <span className="grid size-16 place-items-center rounded-full bg-[var(--eb-nude-a32)] text-[21px] font-medium">
          {profile.initials}
        </span>
        <div>
          <div className="text-xl font-medium">{client?.name ?? profile.name}</div>
          <div className="text-[13px] text-[var(--text-secondary)]">
            {[client?.age ? `${client.age} anos` : null, client?.phone]
              .filter(Boolean)
              .join(" · ") || "Complete seus dados"}
          </div>
        </div>
      </div>

      <span className={label}>Dados pessoais</span>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
        <Input
          label="Nome"
          value={name}
          error={name.trim() ? undefined : "Informe seu nome."}
          onChange={(event) => setName(event.target.value)}
        />
        <Input label="Telefone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        <Input label="E-mail" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Input
          label="Nascimento"
          type="date"
          value={birth}
          onChange={(event) => setBirth(event.target.value)}
        />
        <Input
          label="Endereço"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
        />
        <Input
          label="Objetivo"
          placeholder="O que você quer melhorar?"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
        />
        <Input
          label="Alergias"
          placeholder="Algum ativo ou produto que te faz mal?"
          value={allergies}
          onChange={(event) => setAllergies(event.target.value)}
        />
      </div>
      <Button
        type="button"
        variant="tech"
        className="self-start"
        disabled={!dirty || !name.trim()}
        onClick={save}
      >
        <Icon name="Check" size={18} /> Salvar dados
      </Button>

      {clinic ? (
        <>
          <span className={label}>Sua clínica</span>
          <div className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-4 py-3.5">
            <div className="text-[15px] font-medium">{clinic.name}</div>
            <div className="text-[12.5px] text-[var(--text-secondary)]">
              {[clinic.city, clinic.phone].filter(Boolean).join(" · ")}
            </div>
          </div>
        </>
      ) : null}

      <span className={label}>Preferências de notificação</span>
      <NotificationPrefsEditor audience="cliente" />

      <span className={label}>Consentimentos</span>
      <label className="flex min-h-14 items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5">
        <span className="flex-1">
          <span className="block text-sm">Autorização de imagem</span>
          <span className="block text-[11.5px] text-muted-foreground">
            Uso interno das fotografias de evolução
          </span>
        </span>
        <input
          type="checkbox"
          checked={consent}
          aria-label="Autorização de imagem"
          onChange={() => updateClient(clientId, { imageConsent: !consent })}
          className="size-5 accent-[var(--teal)]"
        />
      </label>
      <div className="rounded-[var(--radius-md)] border border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] px-4 py-3.5 text-[12.5px] text-[var(--text-secondary)]">
        Você pode revogar a autorização de imagem a qualquer momento. Sem ela, as fotos ficam só
        para uso interno da esteticista.
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
      <ToastHost toast={toast ? { message: toast } : null} />
    </div>
  );
}
