import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/eb/icon";
import { IconButton } from "@/components/eb/icon-button";
import { Input } from "@/components/eb/input";
import { Drawer } from "@/components/eb/overlays";
import { Button } from "@/components/ui/button";
import { blocksDb } from "@/data/db";
import { MAX_BLOCK_DAYS as MAX_DAYS, daysInRange } from "@/lib/availability";
import { formatShort, todayISO } from "@/lib/dates";
import type { BlockRec } from "@/lib/models";
import { cn } from "@/lib/utils";
import { newId } from "@/lib/uuid";

const REASONS = [
  { label: "Almoço", allDay: false, start: "12:00", end: "13:00" },
  { label: "Folga", allDay: true },
  { label: "Férias", allDay: true },
  { label: "Compromisso", allDay: false },
] as const;

type Form = {
  date: string;
  dateTo: string;
  allDay: boolean;
  start: string;
  end: string;
  reason: string;
};

const blank = (date: string): Form => ({
  date,
  dateTo: "",
  allDay: false,
  start: "12:00",
  end: "13:00",
  reason: "",
});

const isAllDay = (block: BlockRec) => block.start <= "00:00" && block.end >= "23:59";

/**
 * Bloqueio de horários da agenda: um horário do dia, o dia inteiro ou vários dias seguidos (férias).
 * Serve para criar e para editar; os bloqueios valem na agenda da equipe e na da cliente.
 */
export function BlockTimeDrawer({
  open,
  onClose,
  initialDate,
  editId,
}: {
  open: boolean;
  onClose: (message?: string) => void;
  initialDate?: string;
  /** Se informado, abre editando esse bloqueio. */
  editId?: string | null;
}) {
  const all = blocksDb.use();
  const [form, setForm] = useState<Form>(() => blank(initialDate ?? todayISO()));
  const [editing, setEditing] = useState<string | null>(null);
  const [past, setPast] = useState(false);

  useEffect(() => {
    if (!open) return;
    const target = editId ? all.find((item) => item.id === editId) : undefined;
    if (target) {
      setEditing(target.id);
      setForm({
        date: target.date,
        dateTo: "",
        allDay: isAllDay(target),
        start: isAllDay(target) ? "12:00" : target.start,
        end: isAllDay(target) ? "13:00" : target.end,
        reason: target.reason,
      });
    } else {
      setEditing(null);
      setForm(blank(initialDate ?? todayISO()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId, initialDate]);

  const today = todayISO();
  const list = useMemo(
    () =>
      [...all]
        .filter((item) => past || item.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)),
    [all, past, today],
  );

  const range = !editing && form.dateTo && form.dateTo >= form.date;
  const days = range ? daysInRange(form.date, form.dateTo) : [form.date];
  const invalid =
    !form.date ||
    (!form.allDay && form.end <= form.start) ||
    Boolean(form.dateTo && form.dateTo < form.date);

  const save = () => {
    if (invalid) return;
    const start = form.allDay ? "00:00" : form.start;
    const end = form.allDay ? "23:59" : form.end;
    const reason = form.reason.trim();
    if (editing) {
      blocksDb.set((current) =>
        current.map((item) =>
          item.id === editing ? { ...item, date: form.date, start, end, reason } : item,
        ),
      );
      onClose("Bloqueio atualizado");
      return;
    }
    blocksDb.set((current) => [
      ...current,
      ...days.map((date) => ({ id: newId(), date, start, end, reason })),
    ]);
    onClose(days.length > 1 ? `${days.length} dias bloqueados` : "Horário bloqueado");
  };

  return (
    <Drawer
      open={open}
      onClose={() => onClose()}
      title={editing ? "Editar bloqueio" : "Bloquear horários"}
      subtitle="Horários em que você não atende: somem da agenda da equipe e das clientes"
      footer={
        <>
          <Button type="button" variant="ghost" className="flex-1" onClick={() => onClose()}>
            Fechar
          </Button>
          <Button type="button" className="flex-1" disabled={invalid} onClick={save}>
            {editing
              ? "Salvar alterações"
              : days.length > 1
                ? `Bloquear ${days.length} dias`
                : "Bloquear"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-wrap gap-1.5">
          {REASONS.map((item) => {
            const on = form.reason === item.label;
            return (
              <button
                key={item.label}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    reason: on ? "" : item.label,
                    allDay: item.allDay,
                    ...("start" in item ? { start: item.start, end: item.end } : {}),
                  }))
                }
                className={cn(
                  "min-h-10 rounded-full border px-3.5 text-[13px]",
                  on
                    ? "border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a24)] text-foreground"
                    : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] text-[var(--text-secondary)]",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2.5 rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] p-3.5">
          <div className={cn("grid gap-2.5", editing ? "grid-cols-1" : "grid-cols-2")}>
            <Input
              label={editing ? "Dia" : "A partir do dia"}
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
            {editing ? null : (
              <Input
                label="Até (opcional)"
                type="date"
                min={form.date}
                value={form.dateTo}
                onChange={(event) => setForm({ ...form, dateTo: event.target.value })}
                hint={days.length > 1 ? `${days.length} dias` : undefined}
              />
            )}
          </div>

          <label className="flex min-h-11 items-center gap-3">
            <span className="flex-1 text-[13.5px]">Dia inteiro</span>
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={() => setForm({ ...form, allDay: !form.allDay })}
              className="size-5 accent-[var(--teal)]"
            />
          </label>

          {form.allDay ? null : (
            <div className="grid grid-cols-2 gap-2.5">
              <Input
                label="Das"
                type="time"
                value={form.start}
                onChange={(event) => setForm({ ...form, start: event.target.value })}
              />
              <Input
                label="Às"
                type="time"
                value={form.end}
                error={form.end <= form.start ? "O fim precisa ser depois do início." : undefined}
                onChange={(event) => setForm({ ...form, end: event.target.value })}
              />
            </div>
          )}
          <Input
            label="Motivo"
            placeholder="Almoço, consulta, folga…"
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
          />
          {days.length >= MAX_DAYS ? (
            <p className="text-xs text-muted-foreground">Máximo de {MAX_DAYS} dias por vez.</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <span className="flex-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Bloqueios
          </span>
          <button
            type="button"
            onClick={() => setPast((value) => !value)}
            className="min-h-9 text-[12.5px] text-[var(--teal)]"
          >
            {past ? "Esconder passados" : "Mostrar passados"}
          </button>
        </div>
        {list.map((block) => (
          <div
            key={block.id}
            className={cn(
              "flex items-center gap-2 rounded-[var(--radius-md)] border bg-[var(--surface-card)] py-2 pl-3.5 pr-1.5",
              editing === block.id ? "border-[var(--eb-teal-a40)]" : "border-[var(--border-card)]",
            )}
          >
            <Icon name="Lock" size={15} color="var(--eb-nude-300)" />
            <div className="min-w-0 flex-1">
              <div className="break-words text-[14px]">{block.reason || "Bloqueio"}</div>
              <div className="font-mono text-xs text-muted-foreground">
                {formatShort(block.date)} ·{" "}
                {isAllDay(block) ? "dia inteiro" : `${block.start} às ${block.end}`}
              </div>
            </div>
            <IconButton
              icon="PencilLine"
              label="Editar bloqueio"
              onClick={() => {
                setEditing(block.id);
                setForm({
                  date: block.date,
                  dateTo: "",
                  allDay: isAllDay(block),
                  start: isAllDay(block) ? "12:00" : block.start,
                  end: isAllDay(block) ? "13:00" : block.end,
                  reason: block.reason,
                });
              }}
            />
            <IconButton
              icon="Trash2"
              label="Remover bloqueio"
              onClick={() =>
                blocksDb.set((current) => current.filter((item) => item.id !== block.id))
              }
            />
          </div>
        ))}
        {!list.length ? (
          <p className="text-[13px] text-muted-foreground">
            Nenhum bloqueio {past ? "" : "daqui para frente"}.
          </p>
        ) : null}
        {editing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => {
              setEditing(null);
              setForm(blank(initialDate ?? todayISO()));
            }}
          >
            <Icon name="Plus" size={15} /> Novo bloqueio
          </Button>
        ) : null}
      </div>
    </Drawer>
  );
}
