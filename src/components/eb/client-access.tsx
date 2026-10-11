import { useState } from "react";

import { Icon, WhatsAppIcon } from "@/components/eb/icon";
import { Input } from "@/components/eb/input";
import { Drawer } from "@/components/eb/overlays";
import { Button } from "@/components/ui/button";
import type { ClientRec } from "@/data/db";
import { accessMessage, appLink, generatePassword, signupMessage } from "@/lib/client-access";
import type { Clinic } from "@/lib/use-clinic";
import { openWhatsApp } from "@/lib/whatsapp";
import { createClientAccess } from "@/services/client-access.service";

export type Credentials = { email: string; password: string };

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-field)] py-1.5 pl-3.5 pr-1.5">
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-muted-foreground">{label}</span>
        <span className="block break-all font-mono text-[13.5px]">{value}</span>
      </span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={async () => {
          if (await copyText(value)) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          }
        }}
      >
        <Icon name={copied ? "Check" : "Copy"} size={15} /> {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

/** Campo de senha de acesso, sempre visível (a gestora precisa enviar), com "Gerar senha". */
export function PasswordField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (next: string) => void;
  error?: string | undefined;
}) {
  return (
    <Input
      label="Senha de acesso"
      icon="KeyRound"
      value={value}
      autoComplete="new-password"
      placeholder="Mínimo 8 caracteres"
      error={error}
      hint="A cliente entra com esta senha e pode trocá-la depois, em Perfil."
      onChange={(event) => onChange(event.target.value)}
      trailing={
        <button
          type="button"
          onClick={() => onChange(generatePassword())}
          className="min-h-9 whitespace-nowrap rounded-full px-2.5 text-[12.5px] font-medium text-[var(--teal)]"
        >
          Gerar
        </button>
      }
    />
  );
}

/** Acesso pronto: link, e-mail, senha e envio pelo WhatsApp. */
export function AccessReady({
  client,
  clinicName,
  creds,
  reset,
}: {
  client: Pick<ClientRec, "name" | "phone">;
  clinicName: string;
  creds: Credentials;
  reset?: boolean;
}) {
  const link = appLink();
  const text = accessMessage({
    name: client.name,
    clinic: clinicName,
    link,
    email: creds.email,
    password: creds.password,
  });
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a12)] px-3.5 py-3">
        <Icon name="CheckCircle2" size={18} color="var(--eb-teal-500)" />
        <p className="min-w-0 flex-1 text-[13.5px] leading-snug">
          {reset ? "Senha redefinida." : "Acesso criado."} Esta é a única vez que a senha aparece:
          envie agora para {client.name.split(" ")[0]}.
        </p>
      </div>
      <CopyRow label="Link do app" value={link} />
      <CopyRow label="E-mail" value={creds.email} />
      <CopyRow label="Senha" value={creds.password} />
      <div className="flex flex-wrap gap-2">
        {client.phone ? (
          <Button type="button" onClick={() => openWhatsApp(client.phone, text)}>
            <WhatsAppIcon size={17} /> Enviar acesso pelo WhatsApp
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            if (await copyText(text)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }
          }}
        >
          <Icon name={copied ? "Check" : "Copy"} size={16} />{" "}
          {copied ? "Mensagem copiada" : "Copiar mensagem"}
        </Button>
      </div>
      {client.phone ? null : (
        <p className="text-xs text-muted-foreground">
          Sem celular cadastrado: copie a mensagem e envie por onde preferir.
        </p>
      )}
    </div>
  );
}

/** Formulário de e-mail + senha que cria (ou redefine) o acesso e devolve as credenciais. */
export function AccessForm({
  client,
  mode = "create",
  onDone,
}: {
  client: Pick<ClientRec, "id" | "email">;
  mode?: "create" | "reset";
  onDone: (creds: Credentials) => void;
}) {
  const [email, setEmail] = useState(client.email ?? "");
  const [password, setPassword] = useState(() => generatePassword());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const passOk = password.length >= 8 && password.length <= 72;
  const [tried, setTried] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="E-mail de acesso"
        icon="Mail"
        type="email"
        value={email}
        disabled={mode === "reset"}
        placeholder="cliente@email.com"
        error={tried && !emailOk ? "Confira o e-mail." : undefined}
        hint={
          mode === "create"
            ? "Confira com a cliente: o acesso é criado para este e-mail."
            : undefined
        }
        onChange={(event) => setEmail(event.target.value)}
      />
      <PasswordField
        value={password}
        onChange={setPassword}
        error={tried && !passOk ? "De 8 a 72 caracteres." : undefined}
      />
      {error ? (
        <p role="alert" className="text-[13px] text-[var(--eb-coral-500)]">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        variant="tech"
        disabled={busy}
        onClick={async () => {
          setTried(true);
          if (!emailOk || !passOk) return;
          setBusy(true);
          setError(null);
          const result = await createClientAccess({
            clientId: client.id,
            email,
            password,
            mode,
          });
          setBusy(false);
          if (result.ok) onDone({ email: email.trim().toLowerCase(), password });
          else setError(result.message);
        }}
      >
        <Icon name="KeyRound" size={17} />{" "}
        {busy ? "Criando…" : mode === "reset" ? "Redefinir senha" : "Criar acesso ao app"}
      </Button>
    </div>
  );
}

/** Depois do cadastro: acesso pronto (ou como criar/enviar) e atalho para a ficha. */
export function ClientAccessSuccess({
  client,
  clinic,
  creds,
  accessError,
  onDone,
}: {
  client: ClientRec;
  clinic: Pick<Clinic, "slug" | "name"> | undefined;
  creds?: Credentials | undefined;
  accessError?: string | undefined;
  onDone: () => void;
}) {
  const [made, setMade] = useState<Credentials | undefined>(creds);
  const [creating, setCreating] = useState(false);
  const clinicName = clinic?.name ?? "sua clínica";
  const signupLink =
    typeof window === "undefined" || !clinic
      ? ""
      : `${window.location.origin}/?p=${encodeURIComponent(clinic.slug)}&nome=${encodeURIComponent(clinic.name)}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-[var(--eb-teal-a12)] text-[var(--eb-teal-500)]">
          <Icon name="Check" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[18px] font-medium">Cliente cadastrada</div>
          <div className="break-words text-[13px] text-muted-foreground">{client.name}</div>
        </div>
      </div>

      {accessError ? (
        <p role="alert" className="text-[13px] text-[var(--eb-coral-500)]">
          A ficha foi salva, mas o acesso não foi criado: {accessError}
        </p>
      ) : null}

      {made ? (
        <AccessReady client={client} clinicName={clinicName} creds={made} />
      ) : (
        <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] p-3.5">
          <div className="text-[14px] font-medium">Acesso ao app</div>
          <p className="text-[12.5px] text-[var(--text-secondary)]">
            Crie o e-mail e a senha agora: quando a cliente abrir o link, a conta já existe.
          </p>
          {creating ? (
            <AccessForm
              client={client}
              onDone={(next) => {
                setMade(next);
                setCreating(false);
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="tech" onClick={() => setCreating(true)}>
                <Icon name="KeyRound" size={16} /> Criar acesso agora
              </Button>
              {clinic ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    client.phone
                      ? openWhatsApp(
                          client.phone,
                          signupMessage({
                            name: client.name,
                            clinic: clinicName,
                            link: signupLink,
                          }),
                        )
                      : void copyText(signupLink)
                  }
                >
                  <WhatsAppIcon size={16} />{" "}
                  {client.phone ? "Enviar link de cadastro" : "Copiar link de cadastro"}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      )}

      <Button type="button" variant="secondary" onClick={onDone}>
        Ir para a ficha
      </Button>
    </div>
  );
}

/** Na ficha da cliente: criar o acesso ao app (ainda sem conta) ou redefinir a senha. */
export function ClientAccessDrawer({
  open,
  onClose,
  client,
  clinicName,
}: {
  open: boolean;
  onClose: () => void;
  client: ClientRec;
  clinicName: string;
}) {
  const [creds, setCreds] = useState<{ value: Credentials; reset: boolean } | null>(null);
  const reset = Boolean(client.hasAccess);
  return (
    <Drawer
      open={open}
      onClose={() => {
        setCreds(null);
        onClose();
      }}
      title={reset ? "Acesso ao app" : "Criar acesso ao app"}
      subtitle={client.name}
    >
      <div className="flex flex-col gap-4">
        {creds ? (
          <AccessReady
            client={client}
            clinicName={clinicName}
            creds={creds.value}
            reset={creds.reset}
          />
        ) : reset ? (
          <>
            <p className="text-[13px] text-[var(--text-secondary)]">
              Esta cliente já tem acesso. Se ela esqueceu a senha, defina uma nova e envie pelo
              WhatsApp.
            </p>
            <AccessForm
              client={client}
              mode="reset"
              onDone={(value) => setCreds({ value, reset: true })}
            />
          </>
        ) : (
          <AccessForm client={client} onDone={(value) => setCreds({ value, reset: false })} />
        )}
      </div>
    </Drawer>
  );
}
