import { describe, expect, test } from "bun:test";

import {
  change,
  doneAppointments,
  newClients,
  occupancy,
  periodRange,
  previousRange,
  returnShare,
  sumLedger,
  topProcedures,
  weeklyIncome,
} from "../src/lib/metrics";
import type { AppointmentRec, HoursRec, LedgerEntry, SessionRec } from "../src/lib/models";

const entry = (
  date: string,
  value: number,
  kind: LedgerEntry["kind"] = "entradas",
): LedgerEntry => ({
  id: `${date}-${value}-${kind}`,
  kind,
  date,
  label: "x",
  origin: "x",
  method: "Pix",
  value,
});
const appt = (over: Partial<AppointmentRec>): AppointmentRec =>
  ({
    id: "a",
    clientId: "c",
    client: "x",
    initials: "X",
    procedure: "Limpeza",
    date: "2026-10-12",
    time: "10:00",
    duration: 60,
    price: 100,
    payment: "Pix",
    status: "confirmed",
    kind: "retorno",
    origin: "gestor",
    done: false,
    createdAt: "2026-10-01T00:00:00Z",
    ...over,
  }) as AppointmentRec;

describe("períodos", () => {
  test("este mês vai do dia 1 até hoje; mês passado é o mês inteiro", () => {
    expect(periodRange("mes", "2026-10-09")).toEqual({ from: "2026-10-01", to: "2026-10-09" });
    expect(periodRange("anterior", "2026-10-09")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(periodRange("anterior", "2026-03-15")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(periodRange("30d", "2026-10-30")).toEqual({ from: "2026-10-01", to: "2026-10-30" });
  });
  test("período anterior tem o mesmo tamanho", () => {
    expect(previousRange({ from: "2026-10-01", to: "2026-10-10" })).toEqual({
      from: "2026-09-21",
      to: "2026-09-30",
    });
  });
});

describe("caixa", () => {
  const ledger = [
    entry("2026-10-02", 180),
    entry("2026-10-09", 250),
    entry("2026-09-30", 999),
    entry("2026-10-05", 40, "saidas"),
  ];
  const range = { from: "2026-10-01", to: "2026-10-09" };
  test("soma só o tipo e o período", () => {
    expect(sumLedger(ledger, "entradas", range)).toBe(430);
    expect(sumLedger(ledger, "saidas", range)).toBe(40);
  });
  test("entradas por semana (segunda a domingo)", () => {
    const weeks = weeklyIncome(ledger, range);
    expect(weeks.map((w) => w.from)).toEqual(["2026-09-28", "2026-10-05"]);
    expect(weeks.map((w) => w.value)).toEqual([180, 250]);
  });
  test("variação sobre o período anterior", () => {
    expect(change(150, 100)).toBe(50);
    expect(change(50, 100)).toBe(-50);
    expect(change(10, 0)).toBeNull();
  });
});

describe("atendimentos e clientes", () => {
  test("só os realizados no período e % de retorno", () => {
    const list = [
      appt({ done: true, kind: "retorno" }),
      appt({ done: true, kind: "primeira", id: "b" }),
      appt({ done: false, id: "c" }),
      appt({ done: true, date: "2026-09-01", id: "d" }),
    ];
    const done = doneAppointments(list, { from: "2026-10-01", to: "2026-10-31" });
    expect(done.length).toBe(2);
    expect(returnShare(done)).toBe(50);
    expect(returnShare([])).toBe(0);
  });
  test("novas clientes pelo dia do cadastro", () => {
    const clients = [{ createdAt: "2026-10-03T15:00:00Z" }, { createdAt: "2026-09-30T15:00:00Z" }];
    expect(newClients(clients, { from: "2026-10-01", to: "2026-10-31" }).length).toBe(1);
  });
});

describe("procedimentos mais feitos", () => {
  const session = (names: [string, number][], finishedAt: string): SessionRec =>
    ({
      id: finishedAt + names.join(),
      status: "done",
      finishedAt,
      procedures: names.map(([name, price]) => ({ name, price })),
    }) as SessionRec;
  test("conta por procedimento (mesmo em atendimento com vários) e ordena", () => {
    const top = topProcedures(
      [
        session([["Limpeza", 180]], "2026-10-02T10:00:00Z"),
        session(
          [
            ["Limpeza", 180],
            ["Peeling", 250],
          ],
          "2026-10-03T10:00:00Z",
        ),
        session([["Peeling", 250]], "2026-09-03T10:00:00Z"),
      ],
      { from: "2026-10-01", to: "2026-10-31" },
    );
    expect(top).toEqual([
      { name: "Limpeza", count: 2, revenue: 360 },
      { name: "Peeling", count: 1, revenue: 250 },
    ]);
  });
});

describe("ocupação da agenda", () => {
  const hours: HoursRec = {
    slot: 30,
    days: {
      "0": { open: false, start: "09:00", end: "13:00" },
      "1": { open: true, start: "09:00", end: "13:00" },
      "2": { open: true, start: "09:00", end: "13:00" },
      "3": { open: true, start: "09:00", end: "13:00" },
      "4": { open: true, start: "09:00", end: "13:00" },
      "5": { open: true, start: "09:00", end: "13:00" },
      "6": { open: false, start: "09:00", end: "13:00" },
    },
  };
  // 2026-10-12 é segunda: 240 min abertos
  const day = { from: "2026-10-12", to: "2026-10-12" };
  test("minutos marcados sobre minutos abertos", () => {
    const result = occupancy([appt({ duration: 60 })], hours, [], day);
    expect(result).toEqual({ available: 240, booked: 60, pct: 25 });
  });
  test("bloqueio tira minutos disponíveis; cancelado não conta; domingo fechado", () => {
    const blocks = [{ id: "b", date: "2026-10-12", start: "12:00", end: "13:00", reason: "" }];
    const result = occupancy(
      [appt({ duration: 90 }), appt({ id: "x", status: "cancelled", duration: 60 })],
      hours,
      blocks,
      day,
    );
    expect(result).toEqual({ available: 180, booked: 90, pct: 50 });
    expect(occupancy([], hours, [], { from: "2026-10-11", to: "2026-10-11" }).available).toBe(0);
  });
});
