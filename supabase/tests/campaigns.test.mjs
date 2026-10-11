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
  other = await addUser(db, "o@x.com");
const users = {};
for (const n of ["ana", "bia", "carla", "dani", "eva"]) users[n] = await addUser(db, `${n}@x.com`);
const cid = R(
  await rpc(db, g, "select public.create_clinic('Dona','1','Studio','SP','','autonoma') r"),
).clinic_id;
const si = R(
  await rpc(db, g, "select public.create_staff_invite('S','s@x.com',$1::jsonb) r", [
    JSON.stringify({ clientes: true }),
  ]),
);
await rpc(db, s, "select public.accept_staff_invite($1,'Staff') r", [si.code]);
await rpc(db, other, "select public.create_clinic('Outra','1','Outro','RJ','','autonoma') r");

const join = async (uid, name) => {
  const inv = R(await rpc(db, g, "select public.create_invite($1,'1') r", [name]));
  await rpc(db, uid, "select public.accept_invite($1,null,$2,'1') r", [inv.code, name]);
  return (await q(db, "select client_id from public.profiles where id=$1", [uid]))[0].client_id;
};
const cl = {};
for (const [n, name] of [
  ["ana", "Ana Clara"],
  ["bia", "Bia Souza"],
  ["carla", "Carla Dias"],
  ["dani", "Dani Lopes"],
  ["eva", "Eva Reis"],
])
  cl[n] = await join(users[n], name);

// cliente sem acesso ao app (ficha criada pela gestora, sem login)
const semAcesso = (
  await db.query(
    "insert into public.clients (clinic_id, name, phone, last_visit) values ($1,'Fran Sem Acesso','1', current_date - 90) returning id",
    [cid],
  )
).rows[0].id;

// dados: Ana parada há 70 dias; Bia atendida ontem; Carla faz aniversário daqui a 2 dias; Dani nova sem atendimento; Eva com horário pendente amanhã
await db.query("update public.clients set last_visit = current_date - 70 where id=$1", [cl.ana]);
await db.query("update public.clients set last_visit = current_date - 1 where id=$1", [cl.bia]);
await db.query(
  "update public.clients set birth = (current_date + 2) - interval '30 years' where id=$1",
  [cl.carla],
);
await db.query("update public.clients set created_at = now() - interval '2 days' where id=$1", [
  cl.dani,
]);
await db.query(
  "insert into public.sessions (clinic_id, client_id, procedure, status, finished_at) values ($1,$2,'x','draft', now())",
  [cid, cl.bia],
);
await db.query("update public.sessions set status='done' where client_id=$1", [cl.bia]);
await db.query(
  "insert into public.appointments (clinic_id, client_id, client_name, procedure, date, time, status) values ($1,$2,'Eva Reis','Peeling', current_date + 1, '10:00','pending')",
  [cid, cl.eva],
);

const seg = (type, days = 0, points = 0) => JSON.stringify({ type, days, points });
const preview = async (type, days, points) =>
  R(
    await rpc(db, g, "select public.preview_campaign_audience($1::jsonb) r", [
      seg(type, days, points),
    ]),
  );
const notes = async (uid) =>
  await as(db, uid, () =>
    q(db, "select title, body, href from public.notifications where kind='campaign'"),
  );

// ---- permissões
check(
  "funcionária e cliente não veem nem criam campanhas",
  R(await rpc(db, s, "select public.campaigns_admin() r")).reason === "sem_permissao" &&
    R(
      await rpc(
        db,
        users.ana,
        "select public.save_campaign(null,'x',null,'{}'::jsonb,'t','b','/cliente','ativa',null,null,30) r",
      ),
    ).reason === "sem_permissao",
);
check(
  "cliente não lê as tabelas de campanha",
  (await denied(() => as(db, users.ana, () => q(db, "select * from public.campaigns")))) &&
    (await denied(() => as(db, users.ana, () => q(db, "select * from public.campaign_sends")))),
);

// ---- públicos
check(
  "saudade: só quem está há 70 dias sem vir e sem horário (e que tem acesso ao app)",
  (await preview("inactive", 60)).count === 1 &&
    (await preview("inactive", 60)).sample[0] === "Ana",
  JSON.stringify(await preview("inactive", 60)),
);
check(
  "quem não tem acesso ao app não entra no público",
  !(await preview("inactive", 30)).sample.includes("Fran"),
);
check("aniversário nos próximos 7 dias", (await preview("birthday", 7)).sample.join() === "Carla");
check("aniversário fora da janela não entra", (await preview("birthday", 1)).count === 0);
check(
  "boas-vindas: cadastrada há pouco e sem atendimento",
  (await preview("new", 14)).sample.includes("Dani") &&
    !(await preview("new", 14)).sample.includes("Bia"),
);
check(
  "confirme: horário pendente nos próximos dias",
  (await preview("confirm")).sample.join() === "Eva",
);
check("todas as clientes com acesso", (await preview("all")).count === 5);
check("perto do prêmio exige programa ligado", (await preview("near_reward", 0, 50)).count === 0);
check(
  "tipo inválido vira 'todas' ao salvar, nunca executa nada",
  R(
    await rpc(
      db,
      g,
      "select public.save_campaign(null,'x','custom',$1::jsonb,'t','b','/cliente','rascunho',null,null,30) r",
      [JSON.stringify({ type: "drop table", days: 1 })],
    ),
  ).ok === true &&
    (await q(db, "select segment ->> 'type' t from public.campaigns where name='x'"))[0].t ===
      "all",
);
await db.query("delete from public.campaigns");

// ---- criar e validar
check(
  "sem título é recusado",
  R(
    await rpc(
      db,
      g,
      "select public.save_campaign(null,'a',null,'{}'::jsonb,'','b','/cliente','rascunho',null,null,30) r",
    ),
  ).reason === "titulo_vazio",
);
check(
  "datas invertidas são recusadas",
  R(
    await rpc(
      db,
      g,
      "select public.save_campaign(null,'a',null,'{}'::jsonb,'t','b','/cliente','rascunho','2026-12-31','2026-01-01',30) r",
    ),
  ).reason === "datas_invalidas",
);
const saud = R(
  await rpc(
    db,
    g,
    "select public.save_campaign(null,'Saudade',$1,$2::jsonb,'{nome}, que saudade!','Faz tempo que você não vem. Que tal marcar um horário?','/cliente/agenda','ativa',null,null,30) r",
    ["saudade", seg("inactive", 60)],
  ),
);
check("gestora cria campanha ativa", saud.ok === true);
check(
  "destino fora da lista vira /cliente",
  await (async () => {
    const x = R(
      await rpc(
        db,
        g,
        "select public.save_campaign(null,'Zz','custom','{}'::jsonb,'t','b','//evil.com','rascunho',null,null,30) r",
      ),
    );
    return (
      (await q(db, "select href from public.campaigns where id=$1", [x.id]))[0].href === "/cliente"
    );
  })(),
);

// ---- envio: fora do horário não envia; dentro do horário envia
const lt = (await q(db, "select to_char(now() at time zone 'America/Sao_Paulo','HH24:MI') t"))[0].t;
const [outFrom, outTo] = lt < "12:00" ? ["12:30", "23:59"] : ["00:00", "11:30"];
await rpc(db, g, "select public.save_campaign_limits(2,$1,$2) r", [outFrom, outTo]);
await db.query("select app.run_campaigns(false)");
check("fora do horário permitido, o agendador não envia", (await notes(users.ana)).length === 0);
await rpc(db, g, "select public.save_campaign_limits(2,'00:00','23:59') r");
const sentAuto = Number((await q(db, "select app.run_campaigns(false) n"))[0].n);
check(
  "no horário permitido o agendador envia para o público (1 cliente)",
  sentAuto === 1,
  String(sentAuto),
);
const ana = await notes(users.ana);
check(
  "a cliente recebe o aviso com o nome no texto e o destino certo",
  ana.length === 1 && ana[0].title === "Ana, que saudade!" && ana[0].href === "/cliente/agenda",
  JSON.stringify(ana),
);
check(
  "quem não está no público não recebe",
  (await notes(users.bia)).length === 0 && (await notes(users.carla)).length === 0,
);
check(
  "rodar de novo na mesma janela não repete",
  Number((await q(db, "select app.run_campaigns(false) n"))[0].n) === 0 &&
    (await notes(users.ana)).length === 1,
);
check(
  "o envio fica registrado",
  (
    await q(db, "select count(*)::int n from public.campaign_sends where campaign_id=$1", [saud.id])
  )[0].n === 1,
);

// ---- preferências e limite semanal
const camp2 = R(
  await rpc(
    db,
    g,
    "select public.save_campaign(null,'Novidade','novidade','{\"type\":\"all\"}'::jsonb,'Novidade na clínica','Venha conhecer.','/cliente','ativa',null,null,7) r",
  ),
);
await db.query("insert into public.prefs (user_id, data) values ($1,$2::jsonb)", [
  users.bia,
  JSON.stringify({ cliente: { campaigns: false } }),
]);
await db.query("select app.run_campaigns(false)");
check(
  "quem desligou campanhas não recebe (nem dentro do app)",
  (await notes(users.bia)).length === 0 && (await notes(users.carla)).length >= 1,
);
const camp3 = R(
  await rpc(
    db,
    g,
    "select public.save_campaign(null,'Outra','custom','{\"type\":\"all\"}'::jsonb,'Terceira','x','/cliente','ativa',null,null,3) r",
  ),
);
await db.query("select app.run_campaigns(false)");
check(
  "limite de 2 campanhas por semana por cliente",
  (await notes(users.ana)).length === 2 && (await notes(users.carla)).length === 2,
  JSON.stringify([(await notes(users.ana)).length, (await notes(users.carla)).length]),
);
await rpc(db, g, "select public.save_campaign_limits(0,'00:00','23:59') r");
const before = (await notes(users.dani)).length;
await rpc(db, g, "select public.send_campaign_now($1) r", [camp3.id]);
check("limite 0 pausa todas as campanhas", (await notes(users.dani)).length === before);
await rpc(db, g, "select public.save_campaign_limits(5,'00:00','23:59') r");

// ---- pausar, enviar agora e encerrar
await rpc(db, g, "select public.set_campaign_status($1,'pausada') r", [camp3.id]);
check(
  "campanha pausada não roda sozinha",
  Number((await q(db, "select app.run_campaigns(false) n"))[0].n) === 0,
);
const now = R(await rpc(db, g, "select public.send_campaign_now($1) r", [camp3.id]));
check(
  "enviar agora funciona mesmo pausada, respeitando limite e preferências (só a Ana ainda não tinha recebido esta)",
  now.ok === true && now.sent === 1 && (await notes(users.ana)).length === 3,
  JSON.stringify(now),
);
await rpc(db, g, "select public.set_campaign_status($1,'encerrada') r", [camp3.id]);
check(
  "campanha encerrada não envia nem manualmente",
  R(await rpc(db, g, "select public.send_campaign_now($1) r", [camp3.id])).reason ===
    "campanha_encerrada",
);
await db.query("update public.campaigns set ends_on = current_date - 1 where id=$1", [camp2.id]);
await db.query("select app.run_campaigns(false)");
check(
  "vigência vencida encerra a campanha",
  (await q(db, "select status from public.campaigns where id=$1", [camp2.id]))[0].status ===
    "encerrada",
);

// ---- resultado
await db.query(
  "insert into public.appointments (clinic_id, client_id, client_name, procedure, date, time, status) values ($1,$2,'Ana Clara','Limpeza', current_date + 5, '09:00','pending')",
  [cid, cl.ana],
);
await as(db, users.ana, () =>
  q(db, "update public.notifications set read = true where kind='campaign'"),
);
const adm = R(await rpc(db, g, "select public.campaigns_admin() r"));
const st = adm.campaigns.find((c) => c.id === saud.id);
check(
  "resultado: enviadas, lidas e quem marcou horário em até 14 dias",
  st.sent === 1 && st.read === 1 && st.booked === 1,
  JSON.stringify(st),
);
check(
  "limites aparecem na visão da gestora",
  adm.limits.max_per_week === 5 && adm.limits.from === "00:00",
);
check(
  "horário inválido é recusado",
  R(await rpc(db, g, "select public.save_campaign_limits(2,'20:00','09:00') r")).reason ===
    "horario_invalido",
);

// ---- isolamento
check(
  "outra clínica não vê nem mexe nas campanhas desta",
  R(await rpc(db, other, "select public.campaigns_admin() r")).campaigns.length === 0 &&
    R(await rpc(db, other, "select public.set_campaign_status($1,'ativa') r", [saud.id])).reason ===
      "nao_encontrado" &&
    R(await rpc(db, other, "select public.send_campaign_now($1) r", [saud.id])).reason ===
      "nao_encontrado",
);
check(
  "apagar campanha",
  R(await rpc(db, g, "select public.delete_campaign($1) r", [camp3.id])).ok === true,
);

console.log(`\n${pass} ok, ${fail} falhas`);
process.exit(fail ? 1 : 0);
