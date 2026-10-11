import { addUser, as, createDb } from "./harness.mjs";

let pass = 0,
  fail = 0;
const check = (name, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : "  " + extra}`);
};
const q = (db, sql, p = []) => db.query(sql, p).then((r) => r.rows);
const denied = async (fn) => {
  try {
    const r = await fn();
    return Array.isArray(r) ? r.length === 0 : false;
  } catch {
    return true;
  }
};
const rpc = (db, uid, sql, p = []) => as(db, uid, async () => (await q(db, sql, p))[0]);
const R = (x) => x.r;

const db = await createDb();
const g = await addUser(db, "g@x.com"),
  s = await addUser(db, "s@x.com"),
  c1 = await addUser(db, "c1@x.com"),
  c2 = await addUser(db, "c2@x.com"),
  other = await addUser(db, "o@x.com"),
  oc = await addUser(db, "oc@x.com");
const clinic = R(
  await rpc(db, g, "select public.create_clinic('Dona','1','Studio','SP','','autonoma') r"),
);
const cid = clinic.clinic_id;
const si = R(
  await rpc(db, g, "select public.create_staff_invite('S','s@x.com',$1::jsonb) r", [
    JSON.stringify({ clientes: true, agenda: true, atendimentos: true }),
  ]),
);
await rpc(db, s, "select public.accept_staff_invite($1,'Staff') r", [si.code]);
const join = async (uid, name) => {
  const inv = R(await rpc(db, g, "select public.create_invite($1,'1') r", [name]));
  await rpc(db, uid, "select public.accept_invite($1,null,$2,'1') r", [inv.code, name]);
  return (await q(db, "select client_id from public.profiles where id=$1", [uid]))[0].client_id;
};
// cliente 1 entra ANTES de o programa existir (ainda sem pontos)
const cl1 = await join(c1, "Ana Clara");
const cl2 = await join(c2, "Bia Souza");
const oClinic = R(
  await rpc(db, other, "select public.create_clinic('Outra','1','Outro','RJ','','autonoma') r"),
);
const oInv = R(await rpc(db, other, "select public.create_invite('Zoe','1') r"));
await rpc(db, oc, "select public.accept_invite($1,null,'Zoe','1') r", [oInv.code]);

const total = async (client) =>
  Number(
    (
      await q(
        db,
        "select coalesce(sum(points),0) t from public.loyalty_ledger where client_id=$1",
        [client],
      )
    )[0].t,
  );
const finish = async (client, daysAgo = 0) => {
  const id = (
    await db.query(
      "insert into public.sessions (clinic_id, client_id, procedure, status, finished_at) values ($1,$2,'Limpeza','draft', now() - ($3 || ' days')::interval) returning id",
      [cid, client, String(daysAgo)],
    )
  ).rows[0].id;
  await db.query("update public.sessions set status='done' where id=$1", [id]);
  return id;
};

// ---- programa desligado não concede nada
await finish(cl1, 100);
check("programa desligado: nenhum ponto", (await total(cl1)) === 0);
check(
  "cliente com programa desligado recebe enabled=false",
  R(await rpc(db, c1, "select public.my_loyalty() r")).enabled === false,
);

// ---- só a gestora configura
check(
  "funcionária e cliente não configuram o programa",
  R(await rpc(db, s, "select public.save_loyalty_config(true,false,'{}'::jsonb,'[]'::jsonb) r"))
    .reason === "sem_permissao" &&
    R(await rpc(db, c1, "select public.save_loyalty_config(true,false,'{}'::jsonb,'[]'::jsonb) r"))
      .reason === "sem_permissao",
);
check(
  "cliente não lê as tabelas do programa",
  (await denied(() => as(db, c1, () => q(db, "select * from public.loyalty_ledger")))) &&
    (await denied(() => as(db, c1, () => q(db, "select * from public.loyalty_config")))) &&
    (await denied(() => as(db, c1, () => q(db, "select * from public.ranking_members")))),
);
check(
  "cliente não grava pontos, selos nem ranking direto",
  (await denied(() =>
    as(db, c1, () =>
      q(
        db,
        "insert into public.loyalty_ledger (clinic_id, client_id, event, points, idem_key) values ($1,$2,'x',999,'hack')",
        [cid, cl1],
      ),
    ),
  )) &&
    (await denied(() =>
      as(db, c1, () =>
        q(
          db,
          "insert into public.client_badges (badge_id, client_id) select id, $1 from public.badges",
          [cl1],
        ),
      ),
    )) &&
    (await denied(() =>
      as(db, c1, () =>
        q(
          db,
          "insert into public.ranking_members (client_id, clinic_id, nickname) values ($1,$2,'Hack')",
          [cl1, cid],
        ),
      ),
    )),
);

// ---- liga o programa
const on = R(
  await rpc(db, g, "select public.save_loyalty_config(true,true,$1::jsonb,$2::jsonb) r", [
    JSON.stringify({
      session_done: 10,
      first_visit: 20,
      return_on_time: 10,
      confirmed: 3,
      signup: 5,
      return_days: 45,
    }),
    JSON.stringify([
      { name: "Bronze", min: 0 },
      { name: "Prata", min: 40 },
      { name: "Ouro", min: 100 },
    ]),
  ]),
);
check("gestora liga o programa", on.ok === true, JSON.stringify(on));
check(
  "selos padrão criados ao ligar",
  (await q(db, "select count(*)::int n from public.badges where clinic_id=$1", [cid]))[0].n === 6,
);
const admin = R(await rpc(db, g, "select public.loyalty_admin() r"));
check(
  "níveis arrumados (ids, ordem, primeiro em 0)",
  admin.config.levels.length === 3 &&
    admin.config.levels[0].min === 0 &&
    admin.config.levels[1].id === "prata",
  JSON.stringify(admin.config.levels),
);

// ---- retroativo: atendimento antigo e cadastro
const back = R(await rpc(db, g, "select public.loyalty_backfill() r"));
check(
  "retroativo conta atendimento antigo + 1ª visita + cadastro",
  back.ok === true && (await total(cl1)) === 10 + 20 + 5,
  `${back.created} ${await total(cl1)}`,
);
const again = R(await rpc(db, g, "select public.loyalty_backfill() r"));
check("retroativo não duplica", again.created === 0 && (await total(cl1)) === 35);

// ---- atendimento novo: pontos do atendimento (sem 1ª visita; retorno no prazo só se <= 45 dias)
const sNow = await finish(cl1, 0);
check(
  "atendimento novo depois de 100 dias: só os pontos do atendimento",
  (await total(cl1)) === 45,
);
const sSoon = await finish(cl1, -1);
check(
  "retorno em poucos dias: atendimento + retorno no prazo",
  (await total(cl1)) === 45 + 10 + 10,
  String(await total(cl1)),
);

// ---- idempotência: finalizar de novo não repete
await db.query("update public.sessions set status='draft' where id=$1", [sNow]);
await db.query("update public.sessions set status='done' where id=$1", [sNow]);
check("reabrir e finalizar não duplica pontos", (await total(cl1)) === 65);

// ---- apagar atendimento tira os pontos dele
await db.query("delete from public.sessions where id=$1", [sSoon]);
check("apagar o atendimento remove os pontos dele", (await total(cl1)) === 45);

// ---- presença confirmada: pendente → confirmado
const ap = (
  await db.query(
    "insert into public.appointments (clinic_id, client_id, client_name, procedure, date, time, status) values ($1,$2,'Ana Clara','Peeling', current_date + 3, '10:00','pending') returning id",
    [cid, cl1],
  )
).rows[0].id;
const conf = R(await rpc(db, c1, "select public.confirm_my_appointment($1) r", [ap]));
check("cliente confirma presença e ganha pontos", conf.ok === true && (await total(cl1)) === 48);
await rpc(db, c1, "select public.confirm_my_appointment($1) r", [ap]);
check("confirmar de novo não repete", (await total(cl1)) === 48);

// ---- níveis, selos e avisos
const mine = R(await rpc(db, c1, "select public.my_loyalty() r"));
check(
  "cliente vê pontos e nível",
  mine.enabled === true && mine.points === 48 && mine.level.name === "Prata",
  JSON.stringify(mine.level),
);
check(
  "próximo nível com o que falta",
  mine.next.name === "Ouro" && mine.next.remaining === 52,
  JSON.stringify(mine.next),
);
const earned = mine.badges.filter((b) => b.earned).map((b) => b.name);
check(
  "selo da primeira visita conquistado",
  earned.includes("Primeira visita"),
  JSON.stringify(earned),
);
const notes = (
  await as(db, c1, () => q(db, "select title from public.notifications where kind='reward'"))
).map((r) => r.title);
check(
  "avisos de pontos, selo e nível chegam",
  notes.includes("Você ganhou pontos") &&
    notes.some((t) => t.startsWith("Novo selo")) &&
    notes.some((t) => t.startsWith("Você subiu de nível")),
  JSON.stringify(notes),
);
check(
  "aviso de nível sai uma vez só",
  notes.filter((t) => t.startsWith("Você subiu de nível")).length === 1,
);
check("histórico da cliente lista os lançamentos", mine.history.length >= 5);

// ---- ajuste manual e selo manual (gestora)
check(
  "funcionária não ajusta pontos",
  R(await rpc(db, s, "select public.award_manual($1,50,'x') r", [cl1])).reason === "sem_permissao",
);
const man = R(await rpc(db, g, "select public.award_manual($1,60,'Indicou uma amiga') r", [cl1]));
check("gestora dá pontos manuais com motivo", man.ok === true && (await total(cl1)) === 108);
check(
  "pontos manuais fora do limite são recusados",
  R(await rpc(db, g, "select public.award_manual($1,5000,'x') r", [cl1])).reason ===
    "pontos_invalidos",
);
check(
  "ajuste de cliente de outra clínica é recusado",
  R(await rpc(db, other, "select public.award_manual($1,10,'x') r", [cl1])).reason ===
    "programa_desligado" ||
    R(await rpc(db, other, "select public.award_manual($1,10,'x') r", [cl1])).reason ===
      "nao_encontrado",
);
const embaixadora = (
  await q(db, "select id from public.badges where clinic_id=$1 and builtin='embaixadora'", [cid])
)[0].id;
check(
  "gestora entrega selo manual",
  R(await rpc(db, g, "select public.grant_badge($1,$2) r", [embaixadora, cl2])).ok === true &&
    R(await rpc(db, c2, "select public.my_loyalty() r")).badges.find(
      (b) => b.name === "Embaixadora",
    ).earned === true,
);
check(
  "selo manual não conta por critério",
  R(await rpc(db, c1, "select public.my_loyalty() r")).badges.find((b) => b.name === "Embaixadora")
    .earned === false,
);

// ---- selo próprio
const novo = R(
  await rpc(
    db,
    g,
    "select public.save_badge(null,'Super cliente','Gem','points_total',100,true) r",
  ),
);
check("gestora cria selo por pontos", novo.ok === true);
await db.query("select app.loyalty_refresh($1,$2)", [cid, cl1]);
check(
  "selo novo é concedido quando bate o critério",
  R(await rpc(db, c1, "select public.my_loyalty() r")).badges.find(
    (b) => b.name === "Super cliente",
  )?.earned === true,
);
check(
  "selo sem limite é recusado",
  R(await rpc(db, g, "select public.save_badge(null,'x','Star','sessions_count',0,true) r"))
    .reason === "limite_invalido",
);

// ---- ranking: opcional, com apelido, sem dados pessoais
check(
  "sem entrar, a cliente não vê o ranking",
  R(await rpc(db, c1, "select public.loyalty_ranking() r")).length === 0,
);
check(
  "apelido inválido é recusado",
  R(await rpc(db, c1, "select public.set_ranking_optin(true,'<script>') r")).reason ===
    "apelido_invalido",
);
check(
  "cliente entra no ranking com apelido",
  R(await rpc(db, c1, "select public.set_ranking_optin(true,'Aninha') r")).ok === true,
);
check(
  "apelido repetido na clínica é recusado",
  R(await rpc(db, c2, "select public.set_ranking_optin(true,'aninha') r")).reason ===
    "apelido_em_uso",
);
await rpc(db, c2, "select public.set_ranking_optin(true,'Bibi') r");
const rank = R(await rpc(db, c1, "select public.loyalty_ranking() r"));
check(
  "ranking mostra só posição, apelido e pontos",
  rank.length === 2 &&
    rank[0].position === 1 &&
    rank[0].nickname === "Aninha" &&
    Object.keys(rank[0]).sort().join() === "me,nickname,points,position",
  JSON.stringify(rank),
);
check(
  "o ranking não vaza nome real nem id de cliente",
  !JSON.stringify(rank).includes("Ana Clara") && !JSON.stringify(rank).includes(cl1),
);
check(
  "posição da cliente aparece em my_loyalty",
  R(await rpc(db, c1, "select public.my_loyalty() r")).ranking.position === 1,
);
check(
  "cliente de outra clínica não vê este ranking",
  R(await rpc(db, oc, "select public.loyalty_ranking() r")).length === 0,
);
check(
  "desligar o ranking apaga os apelidos",
  (await rpc(db, g, "select public.save_loyalty_config(true,false,null,null) r"),
  (await q(db, "select count(*)::int n from public.ranking_members"))[0].n === 0),
);
check(
  "com ranking desligado, a cliente não consegue entrar",
  R(await rpc(db, c1, "select public.set_ranking_optin(true,'Aninha') r")).reason ===
    "ranking_desligado",
);

// ---- visão da gestora e isolamento entre clínicas
const adm = R(await rpc(db, g, "select public.loyalty_admin() r"));
check(
  "visão geral da gestora",
  adm.overview.clients === 2 &&
    adm.overview.participants >= 1 &&
    adm.overview.top[0].name === "Ana Clara",
  JSON.stringify(adm.overview),
);
check(
  "funcionária não abre a visão da gestora",
  R(await rpc(db, s, "select public.loyalty_admin() r")).reason === "sem_permissao",
);
check(
  "outra clínica não tem pontos nem selos desta",
  (await total(cl1)) > 0 &&
    R(await rpc(db, other, "select public.loyalty_admin() r")).overview.points_issued === 0,
);
check(
  "selos de uma clínica não aparecem na outra",
  (await as(db, other, () => q(db, "select * from public.badges"))).length === 0,
);
check(
  "gestora lê o livro de pontos da própria clínica",
  (await as(db, g, () => q(db, "select * from public.loyalty_ledger"))).length > 0,
);

console.log(`\n${pass} ok, ${fail} falhas`);
process.exit(fail ? 1 : 0);
