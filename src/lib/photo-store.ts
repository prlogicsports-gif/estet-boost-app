/**
 * Fotografias de evolução por cliente. As imagens ficam em IndexedDB
 * (localStorage não comporta imagem) e a lista em localStorage, sob a chave
 * da cliente. Trocar por backend não muda a tela.
 */
export type VaultPhoto = {
  id: string;
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

const DB = "estetboost-fotos";
const STORE = "fotos";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("sem IndexedDB"));
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
  });
}

export const savePhotoBlob = (id: string, blob: Blob) =>
  run("readwrite", (store) => store.put(blob, id));
export const readPhotoBlob = (id: string) =>
  run<Blob | undefined>("readonly", (store) => store.get(id));
export const deletePhotoBlob = (id: string) => run("readwrite", (store) => store.delete(id));

const listKey = (clientId: string) => `estetboost:fotos-v2:${clientId}`;

export function readPhotoList(clientId: string): VaultPhoto[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(listKey(clientId)) ?? "null");
    return Array.isArray(list) ? (list as VaultPhoto[]) : [];
  } catch {
    return [];
  }
}

export function writePhotoList(clientId: string, list: VaultPhoto[]) {
  try {
    window.localStorage.setItem(listKey(clientId), JSON.stringify(list));
  } catch {
    /* sem armazenamento */
  }
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
  } = {},
): Promise<string> {
  const blob = await shrinkImage(file);
  const id = `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await savePhotoBlob(id, blob);
  const photo: VaultPhoto = {
    id,
    tiradaEm: takenAt(file),
    inseridaEm: new Date().toISOString(),
    autorizada: meta.autorizada ?? false,
    origem: "profissional",
    ...(meta.tipo ? { tipo: meta.tipo } : {}),
    ...(meta.sessaoId ? { sessaoId: meta.sessaoId } : {}),
    ...(meta.procedimento ? { procedimento: meta.procedimento } : {}),
  };
  writePhotoList(clientId, [...readPhotoList(clientId), photo]);
  window.dispatchEvent(new Event("eb-photos-changed"));
  return id;
}

/** Remove uma foto da ficha (e o arquivo). */
export function removePhoto(clientId: string, id: string) {
  deletePhotoBlob(id).catch(() => {});
  writePhotoList(
    clientId,
    readPhotoList(clientId).filter((photo) => photo.id !== id),
  );
  window.dispatchEvent(new Event("eb-photos-changed"));
}

/** Endereço temporário para exibir a foto. Quem chama devolve com `URL.revokeObjectURL`. */
export async function photoUrl(id: string | undefined): Promise<string | null> {
  if (!id) return null;
  const blob = await readPhotoBlob(id).catch(() => undefined);
  return blob ? URL.createObjectURL(blob) : null;
}
