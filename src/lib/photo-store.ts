import { createRemoteStore } from "@/lib/remote-store";
import { supabase } from "@/lib/supabase";
import { newId } from "@/lib/uuid";

/**
 * Fotografias de evolução por cliente. O arquivo fica no Supabase Storage (bucket privado, caminho
 * `{clínica}/{cliente}/{foto}`) e os dados da foto na tabela `photos`. Para exibir, o app pede um
 * endereço assinado de vida curta; quem pode ver o quê é decidido pelo banco (RLS).
 */
export type VaultPhoto = {
  id: string;
  clientId: string;
  /** Caminho do arquivo no Storage. */
  path: string;
  tiradaEm: string;
  inseridaEm: string;
  autorizada: boolean;
  origem: "profissional" | "cliente";
  /** "antes" e "depois" formam o par de um atendimento; as demais são fotos soltas de evolução. */
  tipo?: "antes" | "depois" | undefined;
  /** Atendimento a que o par pertence. */
  sessaoId?: string | undefined;
  procedimento?: string | undefined;
};

const BUCKET = "photos";

async function insertRow(rec: VaultPhoto, clinicId: string) {
  const { error } = await supabase.from("photos").insert({
    id: rec.id,
    clinic_id: clinicId,
    client_id: rec.clientId,
    session_id: rec.sessaoId ?? null,
    tipo: rec.tipo ?? null,
    procedure: rec.procedimento ?? null,
    taken_at: rec.tiradaEm,
    authorized: rec.autorizada,
    storage_path: rec.path,
    origem: rec.origem,
  });
  if (error) throw error;
}

export const photosDb = createRemoteStore<VaultPhoto>({
  key: "photos",
  table: "photos",
  order: { column: "taken_at", ascending: false },
  fromRow: (r) => ({
    id: r.id,
    clientId: r.client_id,
    path: r.storage_path,
    tiradaEm: r.taken_at,
    inseridaEm: r.created_at,
    autorizada: r.authorized,
    origem: r.origem,
    tipo: r.tipo ?? undefined,
    sessaoId: r.session_id ?? undefined,
    procedimento: r.procedure ?? undefined,
  }),
  save: async (rec, prev, ctx) => {
    if (!prev) return insertRow(rec, ctx.session.clinicId);
    const { error } = await supabase
      .from("photos")
      .update({ authorized: rec.autorizada, tipo: rec.tipo ?? null })
      .eq("id", rec.id);
    if (error) throw error;
  },
  remove: async (rec) => {
    const { error } = await supabase.from("photos").delete().eq("id", rec.id);
    if (error) throw error;
    void supabase.storage.from(BUCKET).remove([rec.path]);
  },
});

/** Fotos de uma cliente. */
export const readPhotoList = (clientId: string): VaultPhoto[] =>
  photosDb.get().filter((photo) => photo.clientId === clientId);

/** Envia o arquivo ao Storage. Retorna o caminho. */
export async function uploadPhotoBlob(
  clinicId: string,
  clientId: string,
  id: string,
  blob: Blob,
): Promise<string> {
  const path = `${clinicId}/${clientId}/${id}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

const signed = new Map<string, { url: string; until: number }>();

/** Endereços temporários (10 min) para exibir as fotos; reaproveita os que ainda valem. */
export async function photoUrls(
  photos: Pick<VaultPhoto, "id" | "path">[],
): Promise<Record<string, string>> {
  const now = Date.now();
  const out: Record<string, string> = {};
  const missing = photos.filter((photo) => {
    const hit = signed.get(photo.id);
    if (hit && hit.until > now) {
      out[photo.id] = hit.url;
      return false;
    }
    return true;
  });
  if (missing.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(
      missing.map((photo) => photo.path),
      600,
    );
    for (const entry of (data ?? []) as { path: string | null; signedUrl: string }[]) {
      const photo = missing.find((item) => item.path === entry.path);
      if (photo && entry.signedUrl) {
        signed.set(photo.id, { url: entry.signedUrl, until: now + 540000 });
        out[photo.id] = entry.signedUrl;
      }
    }
  }
  return out;
}

/** Reduz para no máximo 1600px antes de guardar: foto de celular tem de 4 a 8 MB. */
export function shrinkImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.86);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    image.src = url;
  });
}

/** Data em que a foto foi tirada: a do próprio arquivo. Sem ela, hoje. */
export function takenAt(file: File) {
  const date = file.lastModified ? new Date(file.lastModified) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export const dayOf = (iso: string) => iso.slice(0, 10);

/** "Tiradas hoje · 22 de setembro de 2026", "Tirada ontem · …", "Tiradas em …". */
export function takenLabel(day: string, plural: boolean) {
  const verb = plural ? "Tiradas" : "Tirada";
  try {
    const date = new Date(`${day}T12:00:00`);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const diff = Math.round((today.getTime() - date.getTime()) / 86400000);
    const text = date.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return `${verb}${diff === 0 ? " hoje · " : diff === 1 ? " ontem · " : " em "}${text}`;
  } catch {
    return `${verb} em ${day}`;
  }
}

export const timeOf = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

/** Guarda uma foto na ficha da cliente (usado pelo atendimento: antes e depois). Retorna o id. */
export async function addPhoto(
  clientId: string,
  file: File,
  meta: {
    tipo?: "antes" | "depois";
    sessaoId?: string;
    procedimento?: string;
    autorizada?: boolean;
    clinicId: string;
    origem?: "profissional" | "cliente";
  },
): Promise<string> {
  const blob = await shrinkImage(file);
  const id = newId();
  const path = await uploadPhotoBlob(meta.clinicId, clientId, id, blob);
  const photo: VaultPhoto = {
    id,
    clientId,
    path,
    tiradaEm: takenAt(file),
    inseridaEm: new Date().toISOString(),
    autorizada: meta.autorizada ?? false,
    origem: meta.origem ?? "profissional",
    ...(meta.tipo ? { tipo: meta.tipo } : {}),
    ...(meta.sessaoId ? { sessaoId: meta.sessaoId } : {}),
    ...(meta.procedimento ? { procedimento: meta.procedimento } : {}),
  };
  photosDb.set((list) => [photo, ...list]);
  return id;
}

/** Remove uma foto da ficha (e o arquivo). */
export function removePhoto(_clientId: string, id: string) {
  photosDb.set((list) => list.filter((photo) => photo.id !== id));
}

/** Endereço temporário para exibir a foto (10 min). */
export async function photoUrl(id: string | undefined): Promise<string | null> {
  if (!id) return null;
  const photo = photosDb.get().find((item) => item.id === id);
  if (!photo) return null;
  return (await photoUrls([photo]))[id] ?? null;
}
