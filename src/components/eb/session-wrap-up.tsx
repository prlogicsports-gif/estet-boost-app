import { useMemo, useState } from "react";

import { Icon } from "@/components/eb/icon";
import { Button } from "@/components/ui/button";
import {
  addDays,
  baseFor,
  fromAnamnese,
  norm,
  readLearned,
  returnDays,
  writeLearned,
  type Anamnese,
  type CareSuggestion,
  type WrapUpResult,
} from "@/lib/session-care";
import { cn } from "@/lib/utils";

const field =
  "min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-field)] px-3 text-[14.5px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const chip = (on: boolean) =>
  cn(
    "min-h-11 rounded-full border px-3.5 text-[13.5px] transition-colors",
    on
      ? "border-transparent bg-[var(--eb-nude-500)] text-[var(--text-on-nude)]"
      : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] text-[var(--text-secondary)]",
  );

const block =
  "flex flex-col gap-3.5 rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] p-[18px]";

const NO_RETURN_REASONS = [
  "Pacote concluído",
  "Cliente vai avisar",
  "Tratamento pausado",
  "Outro motivo",
];

/**
 * Fechamento do atendimento: retorno (agendar ou registrar o motivo de não
 * reagendar) e cuidados pós-atendimento montados a partir da anamnese.
 */
export function SessionWrapUp({
  clientName,
  procedure,
  anamnese,
  onConfirm,
  onBack,
}: {
  clientName: string;
  procedure: string;
  anamnese?: Anamnese;
  onConfirm: (result: WrapUpResult) => void;
  onBack?: () => void;
}) {
  const [retorno, setRetorno] = useState<"agendar" | "sem">("agendar");
  const [data, setData] = useState(() => addDays(returnDays(procedure)));
  const [hora, setHora] = useState("14:00");
  const [motivo, setMotivo] = useState(NO_RETURN_REASONS[0] ?? "");
  const [learned, setLearned] = useState(readLearned);
  const [novo, setNovo] = useState("");

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: CareSuggestion[] = [];
    const add = (texto: string, motivoTexto: string | null, origem: CareSuggestion["origem"]) => {
      const key = norm(texto);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push({ texto, motivo: motivoTexto, origem });
    };
    fromAnamnese(anamnese).forEach((item) => add(item.texto, item.motivo, "anamnese"));
    learned
      .filter((item) => !item.procedimento || norm(item.procedimento) === norm(procedure))
      .slice()
      .sort((a, b) => b.usos - a.usos)
      .forEach((item) =>
        add(
          item.texto,
          item.usos > 1
            ? `Você já usou ${item.usos} vezes`
            : item.origem === "escrito"
              ? "Escrito por você"
              : "Você já usou 1 vez",
          "aprendido",
        ),
      );
    baseFor(procedure).forEach((texto) => add(texto, null, "base"));
    return out;
  }, [anamnese, learned, procedure]);

  const [marked, setMarked] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    fromAnamnese(anamnese).forEach((item) => (initial[norm(item.texto)] = true));
    baseFor(procedure)
      .slice(0, 2)
      .forEach((texto) => (initial[norm(texto)] = true));
    return initial;
  });

  const toggle = (texto: string) =>
    setMarked((current) => ({ ...current, [norm(texto)]: !current[norm(texto)] }));

  function write() {
    const text = novo.trim();
    if (!text) return;
    const next = learned.slice();
    if (
      !next.some(
        (item) => norm(item.texto) === norm(text) && norm(item.procedimento) === norm(procedure),
      )
    ) {
      next.push({
        texto: text,
        procedimento: procedure,
        usos: 0,
        origem: "escrito",
        criadoEm: new Date().toISOString(),
      });
    }
    setLearned(next);
    writeLearned(next);
    setMarked((current) => ({ ...current, [norm(text)]: true }));
    setNovo("");
  }

  function conclude() {
    const chosen = suggestions.filter((item) => marked[norm(item.texto)]).map((item) => item.texto);
    // Cada cuidado usado conta: é isso que reordena as sugestões depois.
    const next = learned.slice();
    chosen.forEach((texto) => {
      const index = next.findIndex(
        (item) => norm(item.texto) === norm(texto) && norm(item.procedimento) === norm(procedure),
      );
      const current = next[index];
      if (current) next[index] = { ...current, usos: current.usos + 1 };
      else
        next.push({
          texto,
          procedimento: procedure,
          usos: 1,
          origem: "sugerido",
          criadoEm: new Date().toISOString(),
        });
    });
    writeLearned(next);
    onConfirm({
      retorno: retorno === "agendar" ? { data, hora } : null,
      semRetorno: retorno === "sem" ? motivo : null,
      cuidados: chosen,
    });
  }

  const count = suggestions.filter((item) => marked[norm(item.texto)]).length;
  const dateText = (() => {
    try {
      return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      });
    } catch {
      return data;
    }
  })();

  return (
    <div className="flex flex-col gap-[18px]">
      <div>
        <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
          Fechamento do atendimento
        </span>
        <h2 className="mt-2 text-[26px] font-medium leading-[1.2] tracking-[-0.015em]">
          Próximo passo{clientName ? ` de ${clientName.split(" ")[0]}` : ""}
        </h2>
        <p className="mt-1 text-[13.5px] text-[var(--text-secondary)]">
          Defina o retorno e os cuidados que a cliente leva para casa. Eles aparecem no app dela.
        </p>
      </div>

      <section className={block}>
        <div className="flex items-center gap-2.5">
          <Icon name="CalendarClock" size={18} color="var(--eb-nude-300)" />
          <span className="text-[17px] font-medium">Retorno</span>
        </div>
        <div
          role="radiogroup"
          className="grid grid-cols-2 gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] p-1"
        >
          {(
            [
              ["agendar", "Agendar retorno"],
              ["sem", "Sem reagendamento"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={retorno === id}
              onClick={() => setRetorno(id)}
              className={cn(
                "min-h-11 rounded-full text-sm",
                retorno === id
                  ? "bg-[var(--eb-ivory-a10)] font-medium text-foreground"
                  : "text-[var(--text-secondary)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {retorno === "agendar" ? (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
              <label>
                <span className="mb-1.5 block text-[12.5px] text-[var(--text-secondary)]">
                  Data
                </span>
                <input
                  type="date"
                  value={data}
                  onChange={(event) => setData(event.target.value)}
                  className={field}
                />
              </label>
              <label>
                <span className="mb-1.5 block text-[12.5px] text-[var(--text-secondary)]">
                  Horário
                </span>
                <input
                  type="time"
                  value={hora}
                  onChange={(event) => setHora(event.target.value)}
                  className={field}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {[7, 14, 21, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setData(addDays(days))}
                  className={chip(data === addDays(days))}
                >
                  Em {days} dias
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Sugerido para {(procedure || "este procedimento").toLowerCase()}:{" "}
              {returnDays(procedure)} dias. Fica como {dateText}, {hora}, aguardando a confirmação
              da cliente.
            </p>
          </>
        ) : (
          <div className="flex flex-wrap gap-2">
            {NO_RETURN_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => setMotivo(reason)}
                aria-pressed={motivo === reason}
                className={chip(motivo === reason)}
              >
                {reason}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className={block}>
        <div className="flex items-center gap-2.5">
          <Icon name="NotebookPen" size={18} color="var(--eb-nude-300)" />
          <span className="flex-1 text-[17px] font-medium">Cuidados pós-atendimento</span>
          <span className="font-mono text-xs text-muted-foreground">
            {count} {count === 1 ? "marcado" : "marcados"}
          </span>
        </div>
        <p className="text-[12.5px] text-[var(--text-secondary)]">
          Sugestões a partir da anamnese e do que você costuma indicar. Marque, desmarque ou escreva
          um novo.
        </p>
        <div className="flex flex-col gap-2">
          {suggestions.map((item) => {
            const on = Boolean(marked[norm(item.texto)]);
            return (
              <label
                key={item.texto}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border px-3.5 py-3",
                  on
                    ? "border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a12)]"
                    : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)]",
                )}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(item.texto)}
                  className="mt-0.5 size-[18px] flex-none accent-[var(--teal)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-foreground">{item.texto}</span>
                  {item.motivo ? (
                    <span
                      className="mt-[3px] block text-[11.5px]"
                      style={{
                        color:
                          item.origem === "anamnese" ? "var(--eb-amber-500)" : "var(--text-muted)",
                      }}
                    >
                      {item.origem === "anamnese" ? "Da anamnese · " : ""}
                      {item.motivo}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input
            value={novo}
            onChange={(event) => setNovo(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                write();
              }
            }}
            placeholder="Escrever um cuidado…"
            aria-label="Escrever um cuidado"
            className={cn(field, "flex-1")}
          />
          <Button type="button" variant="secondary" disabled={!novo.trim()} onClick={write}>
            <Icon name="Plus" size={18} /> Adicionar
          </Button>
        </div>
        <p className="text-[11.5px] text-muted-foreground">
          O que você escreve fica salvo e volta como sugestão nos próximos atendimentos deste
          procedimento.
        </p>
      </section>

      <div className="flex flex-wrap justify-between gap-2.5">
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack}>
            <Icon name="ChevronLeft" size={18} /> Voltar ao atendimento
          </Button>
        ) : (
          <span />
        )}
        <Button type="button" variant="tech" onClick={conclude}>
          <Icon name="Check" size={18} />{" "}
          {retorno === "agendar" ? "Concluir e agendar retorno" : "Concluir sem retorno"}
        </Button>
      </div>
    </div>
  );
}
