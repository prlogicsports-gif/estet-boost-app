import { useState } from "react";

import { Icon } from "@/components/eb/icon";
import { Input } from "@/components/eb/input";
import { Select } from "@/components/eb/select";
import { Button } from "@/components/ui/button";
import { proceduresDb, type ClientRec } from "@/data/db";

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
};

const NONE = "Definir depois";
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
    client?.mainProcedure && client.mainProcedure !== "Sem procedimento definido"
      ? client.mainProcedure
      : NONE,
  goal: client?.goal ?? "",
  allergies: client?.allergies ?? "",
  contra: client?.contra ?? "",
  note: client?.note ?? "",
  imageConsent: client?.imageConsent ?? false,
});

/** Cadastro completo da cliente: o mesmo formulário serve para cadastrar e para editar. */
export function ClientForm({
  initial,
  submitLabel,
  nameError,
  onSubmit,
}: {
  initial: ClientFormValues;
  submitLabel: string;
  /** Erro vindo de fora (ex.: cliente duplicada); o de campo vazio é daqui. */
  nameError?: (name: string, email: string) => string | undefined;
  onSubmit: (values: ClientFormValues) => void;
}) {
  const [v, setV] = useState(initial);
  const [tried, setTried] = useState(false);
  const catalog = proceduresDb.use().map((item) => item.name);
  const set = <K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) =>
    setV((current) => ({ ...current, [key]: value }));
  const error = !v.name.trim() ? "Escreva o nome da cliente." : nameError?.(v.name, v.email);
  const options = Array.from(
    new Set([NONE, ...catalog, ...(initial.procedure !== NONE ? [initial.procedure] : [])]),
  );

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
        onClick={() => {
          setTried(true);
          if (!error) onSubmit(v);
        }}
      >
        <Icon name="Check" size={18} /> {submitLabel}
      </Button>
    </div>
  );
}
