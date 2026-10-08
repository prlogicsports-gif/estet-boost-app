import { useState } from "react";

import { Input } from "@/components/eb/input";
import { Button } from "@/components/ui/button";
import type { ProcedureRec } from "@/lib/models";
import { saveProcedure } from "@/services/sessions.service";

/** Cria um procedimento na hora: ele entra no catálogo e já pode ser usado no atendimento. */
export function NewProcedureForm({
  onCreate,
  onCancel,
}: {
  onCreate: (procedure: ProcedureRec) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("60");
  const [returnDays, setReturnDays] = useState("14");

  const submit = () => {
    if (!name.trim()) return;
    onCreate(
      saveProcedure({
        name,
        price: Number(price.replace(",", ".")) || 0,
        duration: Number(duration) || 60,
        returnDays: Number(returnDays) || 14,
      }),
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] p-4">
      <Input
        label="Nome do procedimento"
        placeholder="Ex.: Microagulhamento"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <div className="grid grid-cols-3 gap-3">
        <Input
          label="Valor"
          trailing="R$"
          inputMode="decimal"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
        <Input
          label="Duração"
          trailing="min"
          inputMode="numeric"
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
        />
        <Input
          label="Retorno"
          trailing="dias"
          inputMode="numeric"
          value={returnDays}
          onChange={(event) => setReturnDays(event.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" size="sm" disabled={!name.trim()} onClick={submit}>
          Salvar procedimento
        </Button>
      </div>
    </div>
  );
}
