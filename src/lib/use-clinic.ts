import { useEffect, useSyncExternalStore } from "react";

import { appointmentsDb, clientsDb } from "@/data/db";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export type Clinic = {
  id: string;
  slug: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  document: string | null;
  size: "autonoma" | "clinica" | null;
};

type Cache = { id: string; clinic: Clinic | null } | null;
let cache: Cache = null;
let loading: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export async function refreshClinic(id: string) {
  loading = id;
  // "*" para continuar funcionando mesmo antes da migração que cria a coluna `address`
  const { data } = await supabase.from("clinics").select("*").eq("id", id).maybeSingle();
  loading = null;
  const row = data as (Omit<Clinic, "address"> & { address?: string | null }) | null;
  cache = {
    id,
    clinic: row
      ? {
          id: row.id,
          slug: row.slug,
          name: row.name,
          email: row.email,
          phone: row.phone,
          city: row.city,
          address: row.address ?? null,
          document: row.document,
          size: row.size,
        }
      : null,
  };
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** A clínica da pessoa logada (da esteticista, da equipe ou da cliente), lida do Supabase. */
export function useClinic() {
  const session = useSession();
  const snap = useSyncExternalStore(
    subscribe,
    () => cache,
    () => null,
  );
  const clinicId = session?.clinicId ?? "";
  useEffect(() => {
    if (clinicId && (!cache || cache.id !== clinicId) && loading !== clinicId)
      void refreshClinic(clinicId);
  }, [clinicId]);
  const clinic = snap && snap.id === clinicId ? (snap.clinic ?? undefined) : undefined;
  return { clinicId, clinic };
}

/** Clientes guardados neste aparelho (os dados locais são sempre de uma única conta; ver local-data.ts). */
export function useClinicClients() {
  return clientsDb.use();
}

/** Atendimentos guardados neste aparelho. */
export function useClinicAppointments() {
  return appointmentsDb.use();
}
