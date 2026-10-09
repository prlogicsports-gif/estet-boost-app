import { useEffect, useRef, useState } from "react";

import { FaceCamera } from "@/components/eb/face-camera";
import { Icon } from "@/components/eb/icon";
import { Button } from "@/components/ui/button";
import { addPhoto, photoUrl, removePhoto } from "@/lib/photo-store";
import { useSession } from "@/lib/session";

/** Foto do atendimento (antes ou depois): tirada na hora ou anexada. Fica salva na ficha da cliente. */
export function SessionPhotoSlot({
  clientId,
  sessionId,
  procedure,
  tipo,
  photoId,
  authorized,
  onChange,
}: {
  clientId: string;
  sessionId: string;
  procedure: string;
  tipo: "antes" | "depois";
  photoId: string | undefined;
  authorized: boolean;
  onChange: (id: string | undefined) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const me = useSession();
  const [shooting, setShooting] = useState(false);
  const gallery = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    let current: string | null = null;
    photoUrl(photoId).then((next) => {
      current = next;
      if (alive) setUrl(next);
      else if (next) URL.revokeObjectURL(next);
    });
    return () => {
      alive = false;
      if (current) URL.revokeObjectURL(current);
    };
  }, [photoId]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      if (photoId) removePhoto(clientId, photoId);
      onChange(
        await addPhoto(clientId, file, {
          clinicId: me?.clinicId ?? "",
          tipo,
          sessaoId: sessionId,
          procedimento: procedure,
          autorizada: authorized,
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  const title = tipo === "antes" ? "Antes" : "Depois";
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
        {title}
      </span>
      <div className="relative grid aspect-[4/5] w-full place-items-center overflow-hidden rounded-[var(--radius-lg)] border border-dashed border-[var(--border-card)] bg-[var(--surface-card)]">
        {url ? (
          <img src={url} alt={`Foto ${title.toLowerCase()}`} className="size-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 text-center text-[13px] text-muted-foreground">
            <Icon name="Camera" size={26} />
            {tipo === "antes"
              ? "Registre como a pele está antes do procedimento."
              : "Registre o resultado ao final."}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => setShooting(true)}
        >
          <Icon name="Camera" size={15} /> Tirar foto
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => gallery.current?.click()}
        >
          <Icon name="Paperclip" size={15} /> Anexar
        </Button>
        {photoId ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              removePhoto(clientId, photoId);
              onChange(undefined);
            }}
          >
            <Icon name="Trash2" size={15} /> Remover
          </Button>
        ) : null}
      </div>
      <FaceCamera
        open={shooting}
        onClose={() => setShooting(false)}
        onCapture={(file) => void pick(file)}
        title={`Foto ${title.toLowerCase()}`}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
