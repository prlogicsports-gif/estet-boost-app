import { useEffect, useState } from "react";

import { Icon } from "@/components/eb/icon";
import { IconButton } from "@/components/eb/icon-button";
import { Input } from "@/components/eb/input";
import { Drawer } from "@/components/eb/overlays";
import { Select } from "@/components/eb/select";
import { Button } from "@/components/ui/button";
import type { SessionRec } from "@/lib/models";
import { can } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import { deleteFinishedSession, editFinishedSession } from "@/services/sessions.service";

const NOTES: [string, string][] = [
  ["saude", "Atualização de saúde"],
  ["avaliacao", "Avaliação da pele"],
  ["intercorrencias", "Intercorrências"],
  ["recomendacoes", "Recomendações"],
];

/** Corrige um atendimento já finalizado. Caixa e agenda acompanham o que for mudado aqui. */
export function SessionEditor({
  session,
  onClose,
  onDone,
}: {
  session: SessionRec | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [procedures, setProcedures] = useState(session?.procedures ?? []);
  const [notes, setNotes] = useState(session?.notes ?? {});
  const [payment, setPayment] = useState(session?.payment ?? "Pix");
  const me = useSession();
  const fin = can(me, "financeiro");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!session) return;
    setProcedures(session.procedures);
    setNotes(session.notes);
    setPayment(session.payment);
  }, [session]);

  return (
    <Drawer
      open={Boolean(session)}
      onClose={onClose}
      title="Corrigir atendimento"
      subtitle={session ? `${session.client} · ${session.procedure}` : ""}
      width={520}
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            disabled={!fin}
            onClick={async () => {
              if (
                session &&
                window.confirm(
                  "Apagar este atendimento? Ele sai do caixa, do histórico e o estoque volta.",
                )
              ) {
                const outcome = await deleteFinishedSession(session.id);
                if (outcome.ok) onDone("Atendimento apagado");
                else setError(outcome.message);
              }
            }}
          >
            <Icon name="Trash2" size={16} /> Apagar
          </Button>
          <Button
            type="button"
            variant="tech"
            className="flex-1"
            onClick={async () => {
              if (!session) return;
              const outcome = await editFinishedSession(session.id, {
                procedures: procedures.filter((item) => item.name.trim()),
                notes,
                payment,
              });
              if (outcome.ok) onDone("Atendimento corrigido");
              else setError(outcome.message);
            }}
          >
            <Icon name="Check" size={18} /> Salvar correção
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        {procedures.map((item, index) => (
          <div key={index} className="flex items-end gap-2">
            <Input
              label={index === 0 ? "Procedimento" : undefined}
              className="flex-1"
              value={item.name}
              onChange={(event) =>
                setProcedures((list) =>
                  list.map((p, i) => (i === index ? { ...p, name: event.target.value } : p)),
                )
              }
            />
            {fin ? (
              <Input
                label={index === 0 ? "Valor" : undefined}
                className="w-28"
                trailing="R$"
                inputMode="decimal"
                value={String(item.price)}
                onChange={(event) =>
                  setProcedures((list) =>
                    list.map((p, i) =>
                      i === index
                        ? { ...p, price: Number(event.target.value.replace(",", ".")) || 0 }
                        : p,
                    ),
                  )
                }
              />
            ) : null}
            <IconButton
              icon="Trash2"
              label="Remover procedimento"
              onClick={() => setProcedures((list) => list.filter((_, i) => i !== index))}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => setProcedures((list) => [...list, { name: "", price: 0 }])}
        >
          <Icon name="Plus" size={15} /> Procedimento
        </Button>
        {fin ? (
          <Select
            label="Forma de pagamento"
            options={["Pix", "Cartão de crédito", "Cartão de débito", "Dinheiro", "Transferência"]}
            value={payment}
            onChange={(event) => setPayment(event.target.value)}
          />
        ) : null}
        {error ? <p className="text-[13px] text-[var(--eb-coral-500)]">{error}</p> : null}
        {NOTES.map(([key, label]) => (
          <Input
            key={key}
            label={label}
            multiline
            rows={2}
            value={notes[key] ?? ""}
            onChange={(event) => setNotes((list) => ({ ...list, [key]: event.target.value }))}
          />
        ))}
        <p className="text-xs text-muted-foreground">
          Produtos usados e fotos não mudam aqui. As fotos podem ser removidas na aba Fotos.
        </p>
      </div>
    </Drawer>
  );
}
