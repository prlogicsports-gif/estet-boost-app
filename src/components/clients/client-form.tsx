import { useState } from "react";

import { Icon } from "@/components/eb/icon";
import { Input } from "@/components/eb/input";
import { PasswordField } from "@/components/eb/client-access";
import { Select } from "@/components/eb/select";
import { Button } from "@/components/ui/button";
import { proceduresDb, type ClientRec } from "@/data/db";
import { generatePassword } from "@/lib/client-access";
import { usableProcedures } from "@/lib/permissions";
import { useSession } from "@/lib/session";

export type ClientFormValues = {
  name: string;
  phone: string;
  email: string;
  birth: string;
  document: string;
  address: string;
  procedure: string;
  goal: string;
  allergies: string;
  contra: string;
  note: string;
  imageConsent: boolean;
  /** Só no cadastro novo: cria e-mail + senha de acesso ao app junto com a ficha. */
  createAccess: boolean;
  password: string;
};

export const NONE = "Escolher depois";
const LEGACY_NONE = "Definir depois";
const label =
  "text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground";

export const valuesOf = (client?: ClientRec): ClientFormValues => ({
  name: client?.name ?? "",
  phone: client?.phone ?? "",
  email: client?.email ?? "",
  birth: client?.birth ?? "",
  document: client?.document ?? "",
  address: client?.address ?? "",
  procedure:
    client?.mainProcedure &&
    client.mainProcedure !== "Sem procedimento definido" &&
    client.mainProcedure !== LEGACY_NONE
      ? client.mainProcedure
      : NONE,
  goal: client?.goal ?? "",
  allergies: client?.allergies ?? "",
  contra: client?.contra ?? "",
  note: client?.note ?? "",
  imageConsent: client?.imageConsent ?? false,
  createAccess: false,
  password: "",
});

/** Cadastro completo da cliente: o mesmo formulário serve para cadastrar e para editar. */
export function ClientForm({
  initial,
  submitLabel,
  nameError,
  withAccess = false,
  busy = false,
  onSubmit,
}: {
  initial: ClientFormValues;
  submitLabel: string;
  /** Erro vindo de fora (ex.: cliente duplicada); o de campo vazio é daqui. */
  nameError?: (name: string, email: string) => string | undefined;
  /** Cadastro novo: mostra "Criar acesso ao app agora" (e-mail + senha). */
  withAccess?: boolean;
  busy?: boolean;
  onSubmit: (values: ClientFormValues) => void;
}) {
  const [v, setV] = useState(initial);
  const [tried, setTried] = useState(false);
  const session = useSession();
  const catalog = usableProcedures(session, proceduresDb.use()).map((item) => item.name);
  const set = <K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) =>
    setV((current) => ({ ...current, [key]: value }));
  const error = !v.name.trim() ? "Escreva o nome da cliente." : nameError?.(v.name, v.email);
  // procedimentos do catálogo e, por último, "Escolher depois"
  const options = [
    ...Array.from(
      new Set([...catalog, ...(initial.procedure !== NONE ? [initial.procedure] : [])]),
    ),
    NONE,
  ];
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim());
  const accessError = !v.createAccess
    ? undefined
    : !emailOk
      ? "Informe um e-mail válido para criar o acesso."
      : v.password.length < 8 || v.password.length > 72
        ? "A senha precisa ter de 8 a 72 caracteres."
        : undefined;

  return (
    <div className="flex flex-col gap-3.5">
      <span className={label}>Dados pessoais</span>
      <Input
        label="Nome completo"
        icon="User"
        placeholder="Paula Andrade"
        value={v.name}
        error={tried ? error : undefined}
        onChange={(event) => set("name", event.target.value)}
      />
      <div className="grid grid-cols-2 gap-2.5">
        <Input
          label="Celular"
          icon="Phone"
          type="tel"
          placeholder="(11) 90000-0000"
          value={v.phone}
          onChange={(event) => set("phone", event.target.value)}
        />
        <Input
          label="Nascimento"
          type="date"
          value={v.birth}
          onChange={(event) => set("birth", event.target.value)}
        />
      </div>
      <Input
        label="E-mail"
        icon="Mail"
        type="email"
        placeholder="paula@email.com"
        value={v.email}
        onChange={(event) => set("email", event.target.value)}
      />
      {withAccess ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] p-3.5">
          <label className="flex min-h-11 items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium">Criar acesso ao app agora</span>
              <span className="block text-[12px] text-muted-foreground">
                Usa o e-mail acima. Quando a cliente abrir o link, a conta já existe.
              </span>
            </span>
            <input
              type="checkbox"
              checked={v.createAccess}
              onChange={() =>
                setV((current) => ({
                  ...current,
                  createAccess: !current.createAccess,
                  password: current.password || generatePassword(),
                }))
              }
              className="size-5 flex-none accent-[var(--teal)]"
            />
          </label>
          {v.createAccess ? (
            <PasswordField
              value={v.password}
              onChange={(next) => set("password", next)}
              error={tried ? accessError : undefined}
            />
          ) : null}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2.5">
        <Input
          label="CPF"
          inputMode="numeric"
          value={v.document}
          onChange={(event) => set("document", event.target.value)}
        />
        <Input
          label="Endereço"
          placeholder="Rua, número, cidade"
          value={v.address}
          onChange={(event) => set("address", event.target.value)}
        />
      </div>

      <span className={`${label} mt-1`}>Atendimento</span>
      <Select
        label="Procedimento principal"
        options={options}
        value={v.procedure}
        onChange={(event) => set("procedure", event.target.value)}
      />
      <Input
        label="Objetivo"
        placeholder="O que ela quer melhorar?"
        value={v.goal}
        onChange={(event) => set("goal", event.target.value)}
      />

      <span className={`${label} mt-1`}>Saúde</span>
      <Input
        label="Alergias"
        placeholder="Ex.: ácido salicílico"
        value={v.allergies}
        onChange={(event) => set("allergies", event.target.value)}
      />
      <Input
        label="Contraindicações"
        placeholder="Ex.: gestação, isotretinoína"
        value={v.contra}
        onChange={(event) => set("contra", event.target.value)}
      />
      <Input
        label="Observações"
        multiline
        rows={3}
        placeholder="Sensibilidades, histórico, preferências…"
        value={v.note}
        onChange={(event) => set("note", event.target.value)}
      />

      <label className="flex min-h-12 items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5">
        <span className="flex-1 text-[13.5px]">Autorizou o uso interno das fotos de evolução</span>
        <input
          type="checkbox"
          checked={v.imageConsent}
          onChange={() => set("imageConsent", !v.imageConsent)}
          className="size-5 accent-[var(--teal)]"
        />
      </label>

      <Button
        type="button"
        variant="tech"
        disabled={busy}
        onClick={() => {
          setTried(true);
          if (!error && !accessError) onSubmit(v);
        }}
      >
        <Icon name="Check" size={18} /> {busy ? "Salvando…" : submitLabel}
      </Button>
    </div>
  );
}
