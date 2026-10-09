import { addUser, as, createDb } from "./harness.mjs";

let pass = 0,
  fail = 0;
const check = (name, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : "  " + extra}`);
};
const q = (db, sql, p = []) => db.query(sql, p).then((r) => r.rows);
const rpc = (db, uid, sql, p = []) => as(db, uid, async () => (await q(db, sql, p))[0]);
const R = (x) => x.r;

const db = await createDb();
const g = await addUser(db, "g@x.com"),
  s = await addUser(db, "s@x.com"),
  c = await addUser(db, "c@x.com");
const clinic = R(
  await rpc(db, g, "select public.create_clinic('Dona','1','Studio','SP','','autonoma') r"),
);
const cid = clinic.clinic_id;
const si = R(
  await rpc(db, g, "select public.create_staff_invite('S','s@x.com',$1::jsonb) r", [
    JSON.stringify({ agenda: true }),
  ]),
);
await rpc(db, s, "select public.accept_staff_invite($1,'Staff') r", [si.code]);
const ci = R(await rpc(db, g, "select public.create_invite('Cli','1') r"));
await rpc(db, c, "select public.accept_invite($1,null,'Cliente Um','1') r", [ci.code]);
const clientId = (await q(db, "select client_id from public.profiles where id=$1", [c]))[0]
  .client_id;

const local = "(now() at time zone 'America/Sao_Paulo')";
const soon = `case when ${local}::time < '23:40' then ${local}::time + interval '10 minutes' else '23:59'::time end`;
await db.query(
  `insert into public.appointments (clinic_id, client_id, client_name, procedure, date, time, status) values ($1,$2,'Cliente Um','Limpeza', ${local}::date, ${soon}, 'pending')`,
  [cid, clientId],
);
await db.query(
  `insert into public.appointments (clinic_id, client_id, client_name, procedure, date, time, status) values ($1,$2,'Cliente Um','Peeling', ${local}::date + 1, '10:00', 'confirmed')`,
  [cid, clientId],
);
await db.query(
  `insert into public.bills (clinic_id, name, value, due) values ($1,'Aluguel',900, ${local}::date + 2), ($1,'Luz',150, ${local}::date - 3), ($1,'Internet',100, ${local}::date + 20)`,
  [cid],
);
await db.query(
  `insert into public.ledger (clinic_id, kind, date, due, label, origin, value, client_id) values ($1,'receber', ${local}::date, ${local}::date + 1,'Cliente Um','Limpeza',180,$2)`,
  [cid, clientId],
);
await db.query(
  `insert into public.stock (clinic_id, name, quantity, min, unit, expiry) values ($1,'Ácido',1,2,'fr', ${local}::date + 10), ($1,'Vencido',4,1,'un', ${local}::date - 5), ($1,'Ok',9,1,'un', ${local}::date + 200)`,
  [cid],
);
await db.query(`update public.clients set last_visit = ${local}::date - 90 where id=$1`, [
  clientId,
]);
await db.query(
  `insert into public.care (clinic_id, client_id, text, reminder_time) values ($1,$2,'Protetor solar todas as manhãs. Evitar esfoliação','00:00')`,
  [cid, clientId],
);

const titles = async (uid) =>
  (
    await as(db, uid, () =>
      q(db, "select title, body, href, kind from public.notifications order by title"),
    )
  ).map((r) => r.title);
const before = (await q(db, "select count(*)::int n from public.notifications"))[0].n;
const run1 = (await q(db, "select app.run_reminders() n"))[0].n;
const gt = await titles(g),
  st = await titles(s),
  ct = await titles(c);

check("rodar os lembretes gera avisos", run1 > 0);
check(
  "gestora: horário sem confirmação e próximo atendimento",
  gt.some((t) => /ainda não confirmou/.test(t)) &&
    gt.some((t) => /Próximo atendimento em \d+ min/.test(t)),
);
check(
  "gestora: conta a vencer, atrasada e cobrança",
  gt.includes("Aluguel vence em 2 dias") &&
    gt.includes("Luz está atrasada") &&
    gt.some((t) => /Cobrança de Cliente vence amanhã/.test(t)),
);
check(
  "cliente: lembrete 1 hora antes do atendimento",
  ct.includes("Seu atendimento é daqui a pouco"),
  JSON.stringify(ct),
);
check("conta que só vence daqui a 20 dias não avisa", !gt.some((t) => /Internet/.test(t)));
check(
  "gestora: estoque baixo, vencendo e vencido",
  gt.includes("Estoque baixo") &&
    gt.includes("Ácido vence em 10 dias") &&
    gt.includes("Vencido está vencido"),
);
check(
  "gestora: cliente parada no período de retorno",
  gt.includes("Cliente no período de retorno"),
);
check(
  "funcionária com só agenda recebe apenas os de agenda",
  st.length > 0 && st.every((t) => /ainda não confirmou|Próximo atendimento/.test(t)),
  JSON.stringify(st),
);
check(
  "cliente: atendimento hoje e amanhã",
  ct.includes("Seu atendimento é hoje") && ct.includes("Seu atendimento é amanhã"),
);
check(
  "cliente: pagamento a vencer e lembrete do cuidado",
  ct.includes("Pagamento vence amanhã") && ct.includes("Lembrete das 00:00"),
);
check(
  "texto do aviso segue o catálogo do app",
  (
    await as(db, g, () =>
      q(db, "select body from public.notifications where title='Aluguel vence em 2 dias'"),
    )
  )[0].body === "R$ 900 · mensal",
);
check(
  "cliente não recebe avisos da equipe",
  !ct.some((t) => /Estoque|Aluguel|Cobrança de/.test(t)),
);

const mid = (await q(db, "select count(*)::int n from public.notifications"))[0].n;
await db.query("select app.run_reminders()");
check(
  "rodar de novo não repete nenhum aviso",
  (await q(db, "select count(*)::int n from public.notifications"))[0].n === mid,
);

// push: o gatilho nunca atrapalha o aviso
await db.query(
  "insert into app.secrets (name, value) values ('push_url','https://x.supabase.co/functions/v1/send-push'), ('push_secret','segredo') on conflict (name) do update set value = excluded.value",
);
const gId = g;
let ok = true;
try {
  await db.query(
    "insert into public.notifications (clinic_id, recipient_id, rule_key, kind, title) values ($1,$2,'teste:1','reminder','Teste de push')",
    [cid, gId],
  );
} catch {
  ok = false;
}
check(
  "com o push configurado (e sem pg_net) o aviso entra mesmo assim",
  ok && (await titles(g)).includes("Teste de push"),
);
check(
  "ninguém chama o agendador pela API",
  await (async () => {
    try {
      await as(db, g, () => q(db, "select app.run_reminders()"));
      return false;
    } catch {
      return true;
    }
  })(),
);

// aviso semanal para as clientes
const weeklyN = (await q(db, "select app.weekly_nudge(true) n"))[0].n;
const cw = (await titles(c)).filter((t) =>
  /Sua semana de cuidado|cuidar de você|pele|autocuidado|próximo atendimento\?/i.test(t),
);
check(
  "semanal: a cliente recebe 1 aviso, a gestora e a equipe não",
  weeklyN === 1 &&
    cw.length >= 1 &&
    !(await titles(g)).some((t) => /Sua semana de cuidado|autocuidado/.test(t)),
  JSON.stringify([weeklyN, cw]),
);
check(
  "semanal: rodar de novo na mesma semana não repete",
  (await q(db, "select app.weekly_nudge(true) n"))[0].n === 0,
);

console.log(`\n${pass} ok, ${fail} falhas`);
process.exit(fail ? 1 : 0);
