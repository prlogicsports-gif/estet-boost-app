import { useEffect, useState } from "react";

import { Icon } from "@/components/eb/icon";
import { IconButton } from "@/components/eb/icon-button";
import { Input } from "@/components/eb/input";
import { Drawer } from "@/components/eb/overlays";
import { Select } from "@/components/eb/select";
import { Button } from "@/components/ui/button";
import { settingsDb } from "@/data/db";
import {
  DEFAULT_QUESTIONS,
  QUESTION_TYPES,
  SUGGESTED_QUESTIONS,
  isChoice,
  normalizeQuestion,
  normalizeQuestions,
  typeLabel,
  type Question,
  type QuestionType,
} from "@/lib/anamnesis";
import { newId } from "@/lib/uuid";

const blank = (): Question => ({ id: `q-${newId().slice(0, 8)}`, label: "", type: "longtext" });

/**
 * Modelo da anamnese da clínica: a gestora adiciona, edita, ordena e remove perguntas, escolhe o tipo
 * (texto, sim/não, uma ou várias opções, número, data) e marca as obrigatórias e as que viram alerta na ficha.
 */
export function QuestionsDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: (message?: string) => void;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuestions(normalizeQuestions(settingsDb.get().questions));
    setError(null);
  }, [open]);

  const patch = (id: string, change: Partial<Question>) =>
    setQuestions((list) => list.map((item) => (item.id === id ? { ...item, ...change } : item)));
  const move = (index: number, by: -1 | 1) =>
    setQuestions((list) => {
      const target = index + by;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item as Question);
      return next;
    });

  const save = () => {
    const kept = questions.filter((item) => item.label.trim());
    const normalized = kept.map((item) => normalizeQuestion({ ...item, label: item.label.trim() }));
    const noOptions = normalized.find((item) => isChoice(item.type) && !item.options?.length);
    if (noOptions) {
      setError(`Adicione as opções da pergunta "${noOptions.label}" (uma por linha).`);
      return;
    }
    settingsDb.set((current) => ({ ...current, questions: normalized }));
    onClose("Perguntas salvas");
  };

  const unused = SUGGESTED_QUESTIONS.filter(
    (suggestion) => !questions.some((item) => item.label === suggestion.label),
  );

  return (
    <Drawer
      open={open}
      onClose={() => onClose()}
      title="Modelo de anamnese"
      subtitle="Estas perguntas aparecem na ficha de cada cliente"
      width={520}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onClose()}>
            Cancelar
          </Button>
          <Button type="button" variant="tech" className="flex-1" onClick={save}>
            <Icon name="Check" size={18} /> Salvar perguntas
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={() => setQuestions((list) => [...list, blank()])}
        >
          <Icon name="Plus" size={16} /> Nova pergunta
        </Button>

        {questions.map((question, index) => (
          <div
            key={question.id}
            className="flex flex-col gap-2.5 rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] p-3.5"
          >
            <div className="flex items-start gap-1.5">
              <Input
                aria-label={`Pergunta ${index + 1}`}
                className="min-w-0 flex-1"
                placeholder="Escreva a pergunta"
                value={question.label}
                onChange={(event) => patch(question.id, { label: event.target.value })}
              />
              <div className="flex flex-none">
                <IconButton
                  icon="Trash2"
                  label="Remover pergunta"
                  size={40}
                  onClick={() =>
                    setQuestions((list) => list.filter((item) => item.id !== question.id))
                  }
                />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Select
                label="Tipo de resposta"
                className="min-w-0 flex-1"
                options={QUESTION_TYPES.map((item) => item.label)}
                value={typeLabel(question.type)}
                onChange={(event) => {
                  const type = QUESTION_TYPES.find((item) => item.label === event.target.value)
                    ?.id as QuestionType | undefined;
                  if (type) patch(question.id, { type });
                }}
              />
            </div>
            {isChoice(question.type) ? (
              <Input
                label="Opções (uma por linha)"
                multiline
                rows={3}
                value={(question.options ?? []).join("\n")}
                onChange={(event) =>
                  patch(question.id, { options: event.target.value.split("\n") })
                }
              />
            ) : null}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <label className="flex min-h-10 items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={Boolean(question.required)}
                  onChange={() => patch(question.id, { required: !question.required })}
                  className="size-[18px] accent-[var(--teal)]"
                />
                Obrigatória
              </label>
              <label className="flex min-h-10 items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={Boolean(question.flag)}
                  onChange={() => patch(question.id, { flag: !question.flag })}
                  className="size-[18px] accent-[var(--teal)]"
                />
                Alerta na ficha
              </label>
              <span className="ml-auto flex">
                <IconButton
                  icon="ChevronUp"
                  label="Mover para cima"
                  size={40}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                />
                <IconButton
                  icon="ChevronDown"
                  label="Mover para baixo"
                  size={40}
                  disabled={index === questions.length - 1}
                  onClick={() => move(index, 1)}
                />
              </span>
            </div>
          </div>
        ))}

        {questions.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            Nenhuma pergunta. Adicione uma ou restaure o modelo padrão.
          </p>
        ) : null}

        {unused.length ? (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Sugestões
            </span>
            <div className="flex flex-wrap gap-1.5">
              {unused.map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() =>
                    setQuestions((list) => [
                      ...list,
                      { ...suggestion, id: `q-${newId().slice(0, 8)}` },
                    ])
                  }
                  className="min-h-10 max-w-full break-words rounded-full border border-dashed border-[var(--border-card)] px-3.5 py-1.5 text-left text-[13px] text-[var(--text-secondary)]"
                >
                  + {suggestion.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setQuestions(DEFAULT_QUESTIONS.map((item) => ({ ...item })))}
        >
          Restaurar perguntas padrão
        </Button>
        {error ? (
          <p role="alert" className="text-[13px] text-[var(--eb-coral-500)]">
            {error}
          </p>
        ) : null}
      </div>
    </Drawer>
  );
}
