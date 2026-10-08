import { useEffect, useState } from "react";

import { Icon } from "@/components/eb/icon";
import { Input } from "@/components/eb/input";
import { Drawer } from "@/components/eb/overlays";
import { Button } from "@/components/ui/button";
import { anamnesisDb, settingsDb } from "@/data/db";

/** Anamnese da cliente: as perguntas vêm das Configurações e as respostas ficam no prontuário. */
export function AnamnesisEditor({
  clientId,
  open,
  onClose,
  onSaved,
}: {
  clientId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { questions, consentText } = settingsDb.use();
  const current = anamnesisDb.use().find((item) => item.clientId === clientId);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAnswers(current?.answers ?? {});
    setConsent(current?.consent ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId]);

  const save = () => {
    const rec = { clientId, answers, consent, updatedAt: new Date().toISOString() };
    anamnesisDb.set((list) =>
      list.some((item) => item.clientId === clientId)
        ? list.map((item) => (item.clientId === clientId ? rec : item))
        : [...list, rec],
    );
    onSaved();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={current ? "Atualizar anamnese" : "Criar anamnese"}
      subtitle="As perguntas podem ser editadas em Configurações"
      width={520}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="tech" className="flex-1" onClick={save}>
            <Icon name="Check" size={18} /> Salvar anamnese
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        {questions.map((question) => (
          <Input
            key={question.id}
            label={question.label}
            multiline
            rows={2}
            value={answers[question.id] ?? ""}
            onChange={(event) =>
              setAnswers((list) => ({ ...list, [question.id]: event.target.value }))
            }
          />
        ))}
        <label className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] p-3.5">
          <input
            type="checkbox"
            checked={consent}
            onChange={() => setConsent(!consent)}
            className="mt-0.5 size-5 flex-none accent-[var(--teal)]"
          />
          <span className="text-[13px] leading-[1.5] text-[var(--text-secondary)]">
            {consentText}
          </span>
        </label>
      </div>
    </Drawer>
  );
}
