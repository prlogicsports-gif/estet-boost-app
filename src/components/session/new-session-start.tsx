import { useState } from "react";

import { Icon } from "@/components/eb/icon";
import { IconButton } from "@/components/eb/icon-button";
import { Input } from "@/components/eb/input";
import { Button } from "@/components/ui/button";
import { clients } from "@/data/gestor-mock";
import { cn } from "@/lib/utils";

const PROCEDURES = [
  "Limpeza de pele profunda",
  "Peeling suave",
  "Hidratação facial",
  "Drenagem facial",
  "Avaliação inicial",
];
const label =
  "text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground";

/** Primeiro passo do "Novo atendimento": escolher a cliente e o procedimento. */
export function NewSessionStart({
  onStart,
  onCancel,
}: {
  onStart: (clientId: string, procedure: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [procedure, setProcedure] = useState(PROCEDURES[0] ?? "");
  const list = clients.filter(
    (client) => !query || client.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex items-center gap-2.5">
        <IconButton icon="X" label="Cancelar novo atendimento" onClick={onCancel} />
        <div className="flex-1">
          <div className="text-xl font-medium">Novo atendimento</div>
          <div className="text-[12.5px] text-muted-foreground">
            Etapa inicial · cliente e procedimento
          </div>
        </div>
      </div>

      <span className={label}>Cliente</span>
      <Input
        icon="Search"
        placeholder="Buscar cliente"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="flex flex-col gap-2">
        {list.map((client) => {
          const on = clientId === client.id;
          return (
            <button
              key={client.id}
              type="button"
              onClick={() => setClientId(client.id)}
              aria-pressed={on}
              className={cn(
                "flex min-h-[52px] w-full items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2 text-left",
                on
                  ? "border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a12)]"
                  : "border-[var(--border-card)] bg-[var(--surface-card)]",
              )}
            >
              <span className="grid size-[38px] flex-none place-items-center rounded-full bg-[var(--eb-nude-a32)] text-[13px] font-medium">
                {client.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-medium">{client.name}</span>
                <span className="block text-xs text-muted-foreground">{client.mainProcedure}</span>
              </span>
              {on ? <Icon name="Check" size={18} color="var(--eb-teal-500)" /> : null}
            </button>
          );
        })}
        {!list.length ? (
          <p className="text-[13px] text-muted-foreground">Nenhuma cliente com esse nome.</p>
        ) : null}
      </div>

      <span className={label}>Procedimento</span>
      <div className="flex flex-wrap gap-2">
        {PROCEDURES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setProcedure(item)}
            aria-pressed={procedure === item}
            className={cn(
              "min-h-11 rounded-full border px-3.5 text-[13.5px]",
              procedure === item
                ? "border-transparent bg-[var(--eb-nude-500)] text-[var(--text-on-nude)]"
                : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] text-[var(--text-secondary)]",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-1.5 flex justify-between gap-2.5">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="tech"
          disabled={!clientId}
          onClick={() => clientId && onStart(clientId, procedure)}
        >
          Iniciar atendimento <Icon name="ChevronRight" size={18} />
        </Button>
      </div>
      {!clientId ? (
        <p className="text-right text-xs text-muted-foreground">
          Escolha a cliente para continuar.
        </p>
      ) : null}
    </div>
  );
}
