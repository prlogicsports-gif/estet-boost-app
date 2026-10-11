import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/eb/icon";
import { Input } from "@/components/eb/input";
import { Drawer } from "@/components/eb/overlays";
import { Button } from "@/components/ui/button";
import { anamnesisDb, settingsDb } from "@/data/db";
import {
  answerList,
  hasAnswer,
  missingRequired,
  normalizeQuestions,
  type Answer,
  type Question,
} from "@/lib/anamnesis";
import { cn } from "@/lib/utils";

function Pills({
  options,
  selected,
  onPick,
  label,
}: {
  options: string[];
  selected: string[];
  onPick: (option: string) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(option)}
            className={cn(
              "min-h-10 max-w-full break-words rounded-full border px-3.5 py-1.5 text-left text-[13.5px] leading-snug transition-colors",
              on
                ? "border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a24)] text-foreground"
                : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] text-[var(--text-secondary)]",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

/** Campo de uma pergunta da anamnese, conforme o tipo escolhido pela clínica. */
function QuestionField({
  question,
  value,
  onChange,
  error,
}: {
  question: Question;
  value: Answer | undefined;
  onChange: (next: Answer) => void;
  error?: string | undefined;
}) {
  const label = `${question.label}${question.required ? " *" : ""}`;
  const chosen = answerList(value);
  switch (question.type) {
    case "yesno":
    case "single":
    case "multi": {
      const options = question.type === "yesno" ? ["Sim", "Não"] : (question.options ?? []);
      const multi = question.type === "multi";
      return (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] tracking-[0.02em] text-[var(--text-secondary)]">
            {label}
          </span>
          {options.length ? (
            <Pills
              label={question.label}
              options={options}
              selected={chosen}
              onPick={(option) =>
                onChange(
                  multi
                    ? chosen.includes(option)
                      ? chosen.filter((item) => item !== option)
                      : [...chosen, option]
                    : chosen.includes(option)
                      ? ""
                      : option,
                )
              }
            />
          ) : (
            <p className="text-xs text-muted-foreground">Esta pergunta ainda não tem opções.</p>
          )}
          {error ? <p className="text-xs text-[var(--eb-coral-500)]">{error}</p> : null}
        </div>
      );
    }
    case "text":
    case "number":
    case "date":
      return (
        <Input
          label={label}
          type={question.type === "text" ? "text" : question.type}
          value={chosen[0] ?? ""}
          error={error}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    default:
      return (
        <Input
          label={label}
          multiline
          rows={2}
          value={chosen[0] ?? ""}
          error={error}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
}

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
  const { questions: stored, consentText } = settingsDb.use();
  const questions = useMemo(() => normalizeQuestions(stored), [stored]);
  const current = anamnesisDb.use().find((item) => item.clientId === clientId);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [consent, setConsent] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAnswers(current?.answers ?? {});
    setConsent(current?.consent ?? false);
    setTried(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId]);

  const missing = missingRequired(questions, answers);

  const save = () => {
    setTried(true);
    if (missing.length) return;
    // só guarda o que foi respondido
    const kept = Object.fromEntries(
      Object.entries(answers).filter(([, value]) => hasAnswer(value)),
    );
    const rec = { clientId, answers: kept, consent, updatedAt: new Date().toISOString() };
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
      subtitle="As perguntas podem ser editadas em Configurações → Modelos de anamnese"
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
      <div className="flex flex-col gap-4">
        {questions.map((question) => (
          <QuestionField
            key={question.id}
            question={question}
            value={answers[question.id]}
            error={
              tried && question.required && !hasAnswer(answers[question.id])
                ? "Resposta obrigatória."
                : undefined
            }
            onChange={(next) => setAnswers((list) => ({ ...list, [question.id]: next }))}
          />
        ))}
        {questions.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            Nenhuma pergunta no modelo. Adicione em Configurações → Modelos de anamnese.
          </p>
        ) : null}
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
        {tried && missing.length ? (
          <p role="alert" className="text-[13px] text-[var(--eb-coral-500)]">
            Faltam{" "}
            {missing.length === 1
              ? "1 resposta obrigatória"
              : `${missing.length} respostas obrigatórias`}
            .
          </p>
        ) : null}
      </div>
    </Drawer>
  );
}
