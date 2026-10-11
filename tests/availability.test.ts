import { describe, expect, test } from "bun:test";

import { daysInRange, slotsFor, unavailableReason } from "../src/lib/availability";
import type { BlockRec, HoursRec } from "../src/lib/models";

const open = { open: true, start: "08:00", end: "18:00" };
const hours: HoursRec = {
  slot: 30,
  days: {
    "0": { ...open, open: false },
    "1": open,
    "2": open,
    "3": open,
    "4": open,
    "5": open,
    "6": open,
  },
} as HoursRec;
// 2026-10-12 é segunda-feira
const day = "2026-10-12";
const lunch: BlockRec = { id: "b1", date: day, start: "12:00", end: "13:00", reason: "Almoço" };

describe("bloqueios", () => {
  test("horário dentro do bloqueio é recusado, fora é livre", () => {
    expect(unavailableReason(day, "12:30", hours, [lunch])).toContain("bloqueado");
    expect(unavailableReason(day, "13:00", hours, [lunch])).toBeUndefined();
    expect(unavailableReason(day, "11:00", hours, [lunch])).toBeUndefined();
  });
  test("atendimento que invade o bloqueio seguinte é recusado", () => {
    expect(unavailableReason(day, "11:30", hours, [lunch], 60)).toContain("bloqueado");
    expect(unavailableReason(day, "11:00", hours, [lunch], 60)).toBeUndefined();
    expect(unavailableReason(day, "11:00", hours, [lunch], 90)).toContain("bloqueado");
  });
  test("dia inteiro bloqueado não tem horários", () => {
    const off: BlockRec = { id: "b2", date: day, start: "00:00", end: "23:59", reason: "Folga" };
    expect(slotsFor(day, hours, [off])).toEqual([]);
    expect(slotsFor(day, hours, []).length).toBeGreaterThan(10);
  });
  test("slots respeitam a duração do procedimento", () => {
    const withLunch = slotsFor(day, hours, [lunch], 60);
    expect(withLunch).not.toContain("11:30");
    expect(withLunch).toContain("11:00");
    expect(withLunch).toContain("13:00");
  });
  test("intervalo de datas", () => {
    expect(daysInRange("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
    expect(daysInRange("2026-01-01", "2030-01-01").length).toBe(92);
    expect(daysInRange("2026-10-05", "2026-10-01")).toEqual([]);
  });
});
