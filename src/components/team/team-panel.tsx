import { useState } from "react";

import { Icon, WhatsAppIcon } from "@/components/eb/icon";
import { openWhatsApp } from "@/lib/whatsapp";
import { Input } from "@/components/eb/input";
import { Drawer } from "@/components/eb/overlays";
import { StatusBadge } from "@/components/eb/status-badge";
import { PermissionsEditor } from "@/components/team/permissions-editor";
import { Button } from "@/components/ui/button";
import { PERMISSION_KEYS, type Permissions } from "@/lib/auth.types";
import { DEFAULT_STAFF_PERMISSIONS, PERMISSION_INFO } from "@/lib/permissions";
import { useClinic } from "@/lib/use-clinic";
import { useRemote } from "@/lib/use-remote";
import {
  createStaffInvite,
  inviteState,
  listInvites,
  listStaff,
  revokeInvite,
  setStaffActive,
  setStaffPermissions,
  type StaffRow,
} from "@/services/team.service";

const label =
  "text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground";
const toPerms = (value: StaffRow["permissions"]): Permissions =>
  Object.fromEntries(PERMISSION_KEYS.map((key) => [key, value?.[key] === true])) as Permissions;
const shortDate = (iso: string) =>
  new Date(iso)
    .toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    .replace(".", "");

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* sem permissão da área de transferência */
  }
}

/** Configurações → Equipe: convidar funcionárias, escolher o que cada uma acessa, desativar. */
export function TeamPanel({ onToast }: { onToast: (text: string) => void }) {
  const staff = useRemote(listStaff);
  const invites = useRemote(listInvites);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);

  const pending = (invites.data ?? []).filter(
    (item) => item.role === "funcionario" && inviteState(item) === "pendente",
  );
  const reload = () => void Promise.all([staff.reload(), invites.reload()]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className={`${label} flex-1`}>Equipe</span>
        <Button type="button" size="sm" onClick={() => setInviting(true)}>
          <Icon name="UserPlus" size={15} /> Convidar funcionária
        </Button>
      </div>

      {(staff.data ?? []).map((member) => {
        const perms = toPerms(member.permissions);
        return (
          <div
            key={member.id}
            className="flex flex-col gap-2.5 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-medium">{member.name}</div>
                <div className="truncate text-xs text-muted-foreground">{member.email}</div>
              </div>
              <StatusBadge tone={member.active ? "confirmed" : "cancelled"} size="sm">
                {member.active ? "Ativa" : "Desativada"}
              </StatusBadge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PERMISSION_KEYS.filter((key) => perms[key]).map((key) => (
                <span
                  key={key}
                  className="rounded-full bg-[var(--eb-ivory-a06)] px-2 py-[3px] text-[11.5px] text-[var(--text-secondary)]"
                >
                  {PERMISSION_INFO[key].label}
                </span>
              ))}
              {!PERMISSION_KEYS.some((key) => perms[key]) ? (
                <span className="text-xs text-muted-foreground">Sem acesso a nada</span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setEditing(member)}
              >
                <Icon name="ShieldCheck" size={15} /> Permissões
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={async () => {
                  const result = await setStaffActive(member.id, !member.active);
                  onToast(
                    result.ok
                      ? member.active
                        ? `${member.name} foi desativada e perdeu o acesso`
                        : `${member.name} foi reativada`
                      : result.message,
                  );
                  reload();
                }}
              >
                {member.active ? "Desativar" : "Reativar"}
              </Button>
            </div>
          </div>
        );
      })}
      {!staff.loading && !(staff.data ?? []).length ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-card)] px-4 py-5 text-[13px] text-muted-foreground">
          Ainda não há funcionárias. Convide uma e escolha o que ela pode acessar.
        </p>
      ) : null}

      {pending.length ? (
        <>
          <span className={`${label} mt-2`}>Credenciais aguardando cadastro</span>
          {pending.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px]">{invite.name_hint || invite.email_hint}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {invite.email_hint} · vale até {shortDate(invite.expires_at)}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await revokeInvite(invite.id);
                  onToast("Credencial cancelada");
                  reload();
                }}
              >
                Cancelar
              </Button>
            </div>
          ))}
        </>
      ) : null}

      <InviteDrawer
        open={inviting}
        onClose={() => {
          setInviting(false);
          reload();
        }}
      />
      <PermissionsDrawer
        member={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          onToast("Permissões atualizadas");
          reload();
        }}
      />
    </div>
  );
}

function InviteDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { clinic } = useClinic();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [perms, setPerms] = useState<Permissions>(DEFAULT_STAFF_PERMISSIONS);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ code: string; link: string; email: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const close = () => {
    setName("");
    setEmail("");
    setPerms(DEFAULT_STAFF_PERMISSIONS);
    setError(null);
    setCreated(null);
    setCopied(false);
    onClose();
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await createStaffInvite(name, email, perms);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    const code = result.code ?? "";
    const link = `${window.location.origin}/?equipe=${encodeURIComponent(code)}&nome=${encodeURIComponent(clinic?.name ?? "")}`;
    setCreated({ code, link, email: email.trim().toLowerCase() });
  };

  const message = created
    ? `Olá${name ? `, ${name.split(" ")[0]}` : ""}! Você foi convidada para a equipe${clinic ? ` de ${clinic.name}` : ""} na EstetBoost. Crie seu acesso com o e-mail ${created.email}: ${created.link} (credencial ${created.code}, vale 48 horas).`
    : "";

  return (
    <Drawer
      open={open}
      onClose={close}
      title={created ? "Credencial criada" : "Convidar funcionária"}
      subtitle={
        created
          ? "Envie para ela. O código só aparece agora."
          : "Ela entra com a credencial e só acessa o que você marcar"
      }
      width={520}
      footer={
        created ? (
          <Button type="button" variant="tech" className="w-full" onClick={close}>
            Concluir
          </Button>
        ) : (
          <>
            <Button type="button" variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="tech"
              className="flex-1"
              disabled={busy || !email.trim()}
              onClick={() => void submit()}
            >
              <Icon name="KeyRound" size={18} /> Gerar credencial
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="flex flex-col gap-3.5">
          <div className="rounded-[var(--radius-lg)] border border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a12)] px-4 py-4 text-center">
            <div className="font-mono text-[22px] font-medium tracking-[0.08em]">
              {created.code}
            </div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">
              Vale por 48 horas · uso único · só para {created.email}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                void copy(message).then(() => setCopied(true));
              }}
            >
              <Icon name={copied ? "Check" : "Copy"} size={16} />{" "}
              {copied ? "Copiado" : "Copiar mensagem"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => openWhatsApp("", message)}>
              <WhatsAppIcon size={17} /> WhatsApp
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Por segurança, o código não fica salvo em texto: se perder, cancele e gere outro.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          <Input
            label="Nome"
            icon="User"
            placeholder="Nome da funcionária"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            label="E-mail dela"
            icon="Mail"
            type="email"
            placeholder="ela@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            hint="Ela precisa se cadastrar com este mesmo e-mail."
            error={error ?? undefined}
          />
          <span className={label}>O que ela pode acessar</span>
          <PermissionsEditor value={perms} onChange={setPerms} />
        </div>
      )}
    </Drawer>
  );
}

function PermissionsDrawer({
  member,
  onClose,
  onSaved,
}: {
  member: StaffRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [perms, setPerms] = useState<Permissions>(DEFAULT_STAFF_PERMISSIONS);
  const [seen, setSeen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (member && seen !== member.id) {
    setSeen(member.id);
    setPerms(toPerms(member.permissions));
  }
  if (!member && seen) setSeen(null);

  return (
    <Drawer
      open={Boolean(member)}
      onClose={onClose}
      title="Permissões"
      subtitle={member ? `${member.name} · vale na hora` : ""}
      width={520}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="tech"
            className="flex-1"
            onClick={async () => {
              if (!member) return;
              const result = await setStaffPermissions(member.id, perms);
              if (result.ok) onSaved();
              else setError(result.message);
            }}
          >
            <Icon name="Check" size={18} /> Salvar permissões
          </Button>
        </>
      }
    >
      <PermissionsEditor value={perms} onChange={setPerms} />
      {error ? <p className="mt-3 text-[13px] text-[var(--eb-coral-500)]">{error}</p> : null}
    </Drawer>
  );
}
