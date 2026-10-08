import { activityDb } from "@/data/db";
import type { ActivityRec } from "@/lib/models";

const LIMIT = 500;

/** Anota no histórico da clínica o que uma cliente ou a esteticista fez. */
export function logActivity(entry: Omit<ActivityRec, "id" | "at">) {
  const rec: ActivityRec = {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    ...entry,
  };
  activityDb.set((list) => [rec, ...list].slice(0, LIMIT));
}
