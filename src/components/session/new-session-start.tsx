import { useState } from "react";

import { Icon } from "@/components/eb/icon";
import { IconButton } from "@/components/eb/icon-button";
import { Input } from "@/components/eb/input";
import { NewProcedureForm } from "@/components/session/new-procedure-form";
import { Button } from "@/components/ui/button";
import { proceduresDb, sessionsDb } from "@/data/db";
import type { ProcedureRec } from "@/lib/models";
import { usableProcedures } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { brl } from "@/lib/view";
import {
  cancelSession,
  discardIfEmpty,
  productsOfProcedure,
  startSession,
  updateSession,
} from "@/services/sessions.service";
import { useClinicClients } from "@/lib/use-clinic";

const label =
  "text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground";

/**
 * Primeiro passo do "Novo atendimento": escolher a cliente e o procedimento (ou criar um na hora).
 * Assim que a cliente é escolhida o atendimento já existe como rascunho e tudo é salvo sozinho.
 */
export function NewSessionStart({
  onStart,
  onCancel,
}: {
  onStart: (sessionId: string) => void;
  onCancel: () => void;
}) {
  const clients = useClinicClients();
  const me = useSession();
  const procedures = usableProcedures(me, proceduresDb.use());
  const isGestor = me?.role === "gestor";
  const drafts = sessionsDb.use().filter((item) => item.status === "draft");
  const [query, setQuery] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const draft = drafts.find((item) => item.id === draftId);

  const list = clients.filter(
    (client) => !query || client.name.toLowerCase().includes(query.toLowerCase()),
  );

  const pickClient = (clientId: string) => {
    if (draftId && draft?.clientId !== clientId) discardIfEmpty(draftId);
    setDraftId(startSession({ clientId })?.id ?? null);
  };

  const pickProcedure = (item: ProcedureRec) => {
    if (!draftId) return;
    updateSession(draftId, {
      procedures: [{ name: item.name, price: item.price }],
      products: productsOfProcedure(item),
    });
  };

  const cancel = () => {
    if (draftId) discardIfEmpty(draftId);
    onCancel();
  };

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-[18px]">
      <div className="flex items-center gap-2.5">
        <IconButton icon="X" label="Cancelar novo atendimento" onClick={cancel} />
        <div className="flex-1">
          <div className="text-xl font-medium">Novo atendimento</div>
          <div className="text-[12.5px] text-muted-foreground">
            Etapa inicial · cliente e procedimento
          </div>
        </div>
        {draft ? (
          <span className="text-xs text-[var(--eb-teal-500)]">Salvo automaticamente</span>
        ) : null}
      </div>

      {drafts.filter((item) => item.id !== draftId).length ? (
        <div className="flex flex-col gap-2">
          <span className={label}>Em andamento</span>
          {drafts
            .filter((item) => item.id !== draftId)
            .map((item) => (
              <div
                key={item.id}
                className="flex min-h-[52px] items-center gap-3 rounded-[var(--radius-md)] border border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a12)] px-3 py-2"
              >
                <span className="grid size-[38px] flex-none place-items-center rounded-full bg-[var(--eb-nude-a32)] text-[13px] font-medium">
                  {item.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-medium">{item.client}</span>
                  <span className="block text-xs text-muted-foreground">
                    {item.procedure || "Sem procedimento"} · etapa {item.step + 1}
                  </span>
                </span>
                <Button type="button" size="sm" onClick={() => onStart(item.id)}>
                  Retomar
                </Button>
                <IconButton
                  icon="Trash2"
                  label="Descartar rascunho"
                  onClick={() => cancelSession(item.id)}
                />
              </div>
            ))}
        </div>
      ) : null}

      <span className={label}>Cliente</span>
      <Input
        icon="Search"
        placeholder="Buscar cliente"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto">
        {list.map((client) => {
          const on = draft?.clientId === client.id;
          return (
            <button
              key={client.id}
              type="button"
              onClick={() => pickClient(client.id)}
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
        {procedures.map((item) => {
          const on = draft?.procedures[0]?.name === item.name;
          return (
            <button
              key={item.id}
              type="button"
              disabled={!draft}
              onClick={() => pickProcedure(item)}
              aria-pressed={on}
              className={cn(
                "min-h-11 rounded-full border px-3.5 text-[13.5px] disabled:opacity-50",
                on
                  ? "border-transparent bg-[var(--eb-nude-500)] text-[var(--text-on-nude)]"
                  : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] text-[var(--text-secondary)]",
              )}
            >
              {item.name} · {brl(item.price)}
            </button>
          );
        })}
        {isGestor ? (
          <button
            type="button"
            disabled={!draft}
            onClick={() => setCreating(true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-[var(--border-hairline)] px-3.5 text-[13.5px] text-[var(--text-secondary)] disabled:opacity-50"
          >
            <Icon name="Plus" size={15} /> Criar procedimento
          </button>
        ) : null}
      </div>
      {creating ? (
        <NewProcedureForm
          onCancel={() => setCreating(false)}
          onCreate={(rec) => {
            pickProcedure(rec);
            setCreating(false);
          }}
        />
      ) : null}

      <div className="mt-1.5 flex justify-between gap-2.5">
        <Button type="button" variant="ghost" onClick={cancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="tech"
          disabled={!draft}
          onClick={() => draft && onStart(draft.id)}
        >
          Iniciar atendimento <Icon name="ChevronRight" size={18} />
        </Button>
      </div>
      {!draft ? (
        <p className="text-right text-xs text-muted-foreground">
          Escolha a cliente para continuar.
        </p>
      ) : null}
    </div>
  );
}
