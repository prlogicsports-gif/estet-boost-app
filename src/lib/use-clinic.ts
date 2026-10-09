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
  const { data } = await supabase
    .from("clinics")
    .select("id, slug, name, email, phone, city, document, size")
    .eq("id", id)
    .maybeSingle();
  loading = null;
  cache = { id, clinic: (data as Clinic | null) ?? null };
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
