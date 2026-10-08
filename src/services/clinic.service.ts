import { clinicsDb, DEMO_CLINIC } from "@/data/db";
import type { SignupData } from "@/lib/auth.types";
import type { ClinicRec } from "@/lib/models";

export const slugOf = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const clinicBySlug = (slug: string | null | undefined) =>
  slug ? clinicsDb.get().find((item) => item.slug === slug) : undefined;
export const clinicById = (id: string | undefined) =>
  clinicsDb.get().find((item) => item.id === (id ?? DEMO_CLINIC));

/** Cria a clínica no cadastro da esteticista. O endereço do link (slug) é único. */
export function createClinic(
  input: Pick<SignupData, "name" | "email" | "phone" | "studio" | "city" | "document" | "size">,
): ClinicRec {
  const base = slugOf(input.studio) || slugOf(input.name) || "clinica";
  let slug = base;
  for (let n = 2; clinicsDb.get().some((item) => item.slug === slug); n += 1) slug = `${base}-${n}`;
  const rec: ClinicRec = {
    id: `cl-${Date.now()}`,
    slug,
    name: input.studio.trim() || input.name.trim(),
    owner: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim() || undefined,
    city: input.city.trim() || undefined,
    document: input.document.trim() || undefined,
    size: input.size,
    createdAt: new Date().toISOString(),
  };
  clinicsDb.set((list) => [...list, rec]);
  return rec;
}

export function updateClinic(
  id: string,
  patch: Partial<Omit<ClinicRec, "id" | "slug" | "createdAt">>,
) {
  clinicsDb.set((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
}
