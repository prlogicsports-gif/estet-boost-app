import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";

import { FaceCamera } from "@/components/eb/face-camera";
import { Icon } from "@/components/eb/icon";
import { PhotoComparator } from "@/components/eb/photo-comparator";
import { StatusBadge } from "@/components/eb/status-badge";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";
import {
  addPhoto,
  dayOf,
  photosDb,
  photoUrls,
  removePhoto,
  takenLabel,
  timeOf,
  type VaultPhoto,
} from "@/lib/photo-store";
import { cn } from "@/lib/utils";

/**
 * Fotografias de evolução, por cliente. No topo fica sempre o espaço de inserir
 * (botão, câmera ou arrastar). Abaixo, as fotos agrupadas pela data em que foram
 * tiradas (lida do arquivo), da mais recente para a mais antiga.
 */
export function PhotoVault({
  clientId,
  canEdit = true,
  canUpload = true,
}: {
  clientId: string;
  canEdit?: boolean;
  canUpload?: boolean;
}) {
  const session = useSession();
  const all = photosDb.use();
  const list = useMemo(() => all.filter((photo) => photo.clientId === clientId), [all, clientId]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [opened, setOpened] = useState<VaultPhoto | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"slider" | "side">("slider");
  const inputRef = useRef<HTMLInputElement>(null);
  const [shooting, setShooting] = useState(false);

  // Endereços assinados de vida curta para exibir as fotos (renovados quando a lista muda).
  useEffect(() => {
    let alive = true;
    void photoUrls(list).then((map) => {
      if (alive) setUrls(map);
    });
    return () => {
      alive = false;
    };
  }, [list]);

  function insert(files: FileList | File[] | null) {
    const images = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!images.length || !session) return;
    setError(null);
    setSending((count) => count + images.length);
    images.forEach((file) => {
      addPhoto(clientId, file, {
        clinicId: session.clinicId,
        autorizada: !canEdit,
        origem: canEdit ? "profissional" : "cliente",
      })
        .catch(() => setError("Não foi possível enviar uma das fotos. Tente de novo."))
        .finally(() => setSending((count) => Math.max(0, count - 1)));
    });
  }

  function remove(photo: VaultPhoto) {
    removePhoto(clientId, photo.id);
    if (opened?.id === photo.id) setOpened(null);
  }

  function authorizeDay(day: string, value: boolean) {
    photosDb.set((current) =>
      current.map((item) =>
        item.clientId === clientId && dayOf(item.tiradaEm) === day
          ? { ...item, autorizada: value }
          : item,
      ),
    );
  }

  // A cliente vê as autorizadas e as que ela mesma enviou.
  const visible = list
    .filter((photo) => canEdit || photo.autorizada || photo.origem === "cliente")
    .slice()
    .sort((a, b) => b.tiradaEm.localeCompare(a.tiradaEm));
  const days: string[] = [];
  const byDay: Record<string, VaultPhoto[]> = {};
  for (const photo of visible) {
    const day = dayOf(photo.tiradaEm);
    if (!byDay[day]) {
      byDay[day] = [];
      days.push(day);
    }
    byDay[day].push(photo);
  }

  // Pares de um mesmo atendimento: o antes e o depois lado a lado, com a data e o procedimento.
  const pairs = Object.values(
    visible.reduce<Record<string, { before?: VaultPhoto; after?: VaultPhoto }>>((acc, photo) => {
      if (!photo.sessaoId || !photo.tipo) return acc;
      const entry = acc[photo.sessaoId] ?? {};
      if (photo.tipo === "antes") entry.before = photo;
      else entry.after = photo;
      acc[photo.sessaoId] = entry;
      return acc;
    }, {}),
  )
    .filter((pair): pair is { before: VaultPhoto; after: VaultPhoto } =>
      Boolean(pair.before && pair.after),
    )
    .sort((a, b) => b.after.tiradaEm.localeCompare(a.after.tiradaEm));

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (canUpload) insert(event.dataTransfer.files);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span className="flex-1 text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
          Fotografias
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {visible.length === 1 ? "1 foto" : `${visible.length} fotos`}
        </span>
      </div>

      {canUpload ? (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          className={cn(
            "flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border-[1.5px] border-dashed px-[18px] py-[26px] text-center transition-colors",
            dragging
              ? "border-[var(--eb-teal-500)] bg-[var(--eb-teal-a12)]"
              : "border-[var(--border-strong)] bg-[var(--eb-ivory-a06)]",
          )}
        >
          <span className="grid size-12 place-items-center rounded-full bg-[var(--eb-nude-a16)] text-[var(--eb-nude-300)]">
            <Icon name="ImagePlus" size={22} />
          </span>
          <div>
            <div className="text-[17px] font-medium">
              {sending
                ? `Guardando ${sending} ${sending === 1 ? "foto…" : "fotos…"}`
                : "Inserir fotos"}
            </div>
            <p className="mx-auto mt-1 max-w-[40ch] text-[12.5px] text-[var(--text-secondary)]">
              Tire uma foto agora ou escolha da galeria. Você pode enviar várias de uma vez; a data
              em que cada uma foi tirada é registrada.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={() => inputRef.current?.click()}>
              <Icon name="Images" size={18} /> Escolher imagens
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShooting(true)}>
              <Icon name="Camera" size={18} /> Tirar foto
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              insert(event.target.files);
              event.target.value = "";
            }}
          />
          <FaceCamera
            open={shooting}
            onClose={() => setShooting(false)}
            onCapture={(file) => insert([file])}
            title="Nova foto"
            initialFacing={canEdit ? "environment" : "user"}
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-[12.5px] text-[var(--eb-coral-500)]">
          {error}
        </p>
      ) : null}

      {pairs.length ? (
        <div className="flex flex-col gap-3.5">
          <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
            Antes e depois
          </span>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(260px,100%),380px))] gap-4">
            {pairs.map((pair) => {
              const before = urls[pair.before.id];
              const after = urls[pair.after.id];
              if (!before || !after) return null;
              return (
                <PhotoComparator
                  key={pair.after.id}
                  before={{ src: before, label: "Antes" }}
                  after={{ src: after, label: "Depois" }}
                  mode={mode}
                  onModeChange={setMode}
                  meta={[
                    { icon: "CalendarDays", label: takenLabel(dayOf(pair.after.tiradaEm), false) },
                    ...(pair.after.procedimento
                      ? [{ icon: "Sparkles", label: pair.after.procedimento }]
                      : []),
                  ]}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {days.length === 0 ? (
        <p className="py-1 text-center text-[13px] text-muted-foreground">
          {canUpload
            ? "Nenhuma foto ainda. As datas aparecem aqui assim que você inserir."
            : "Suas fotos de evolução aparecem aqui quando a profissional registrar e você autorizar."}
        </p>
      ) : null}

      {days.map((day) => {
        const photos = byDay[day] ?? [];
        const allAuthorized = photos.every((photo) => photo.autorizada);
        return (
          <div key={day} className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--border-hairline)] pb-1.5">
              <Icon name="CalendarDays" size={15} color="var(--eb-nude-300)" />
              <span className="min-w-0 flex-1 text-[13.5px] font-medium">
                {takenLabel(day, photos.length !== 1)}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {photos.length === 1 ? "1 foto" : `${photos.length} fotos`}
              </span>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => authorizeDay(day, !allAuthorized)}
                  aria-pressed={allAuthorized}
                  className="flex min-h-11 items-center"
                >
                  <StatusBadge
                    tone={allAuthorized ? "confirmed" : "neutral"}
                    size="sm"
                    icon={allAuthorized ? "ShieldCheck" : "Lock"}
                  >
                    {allAuthorized ? "Autorizadas" : "Uso interno"}
                  </StatusBadge>
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--eb-plum-800)]"
                >
                  {urls[photo.id] ? (
                    <button
                      type="button"
                      onClick={() => setOpened(photo)}
                      aria-label={`Ampliar foto, ${takenLabel(day, false).toLowerCase()}`}
                      className="absolute inset-0 cursor-zoom-in border-0 bg-transparent p-0"
                    >
                      <img
                        src={urls[photo.id]}
                        alt={`Foto ${takenLabel(day, false).toLowerCase()}`}
                        className="block size-full object-cover"
                      />
                    </button>
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                      <Icon name="Loader" size={16} />
                    </div>
                  )}
                  <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-full bg-[rgba(36,28,32,.7)] px-[7px] py-0.5 font-mono text-[10.5px]">
                    {photo.tipo ? `${photo.tipo === "antes" ? "Antes" : "Depois"} · ` : ""}
                    {timeOf(photo.tiradaEm)}
                  </span>
                  {canEdit || photo.origem === "cliente" ? (
                    <button
                      type="button"
                      onClick={() => remove(photo)}
                      aria-label="Remover foto"
                      className="absolute right-1 top-1 grid size-11 place-items-center text-foreground"
                    >
                      <span className="grid size-[30px] place-items-center rounded-full border border-[var(--glass-border)] bg-[rgba(36,28,32,.7)]">
                        <Icon name="X" size={13} />
                      </span>
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {opened && urls[opened.id] ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foto ampliada"
          onClick={() => setOpened(null)}
          className="fixed inset-0 z-[90] flex cursor-zoom-out flex-col items-center justify-center gap-3 bg-[rgba(20,14,17,.88)] p-6"
        >
          <img
            src={urls[opened.id]}
            alt="Foto ampliada"
            className="max-h-[85%] max-w-full rounded-[var(--radius-lg)] object-contain"
          />
          <span className="text-[13px] text-[var(--text-secondary)]">
            {takenLabel(dayOf(opened.tiradaEm), false)} · {timeOf(opened.tiradaEm)}
          </span>
        </div>
      ) : null}
    </section>
  );
}
