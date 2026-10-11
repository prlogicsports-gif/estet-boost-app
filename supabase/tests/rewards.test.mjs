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
const cid = R(
  await rpc(db, g, "select public.create_clinic('Dona','1','Studio','SP','','autonoma') r"),
).clinic_id;
const si = R(
  await rpc(db, g, "select public.create_staff_invite('S','s@x.com',$1::jsonb) r", [
    JSON.stringify({ clientes: true }),
  ]),
);
await rpc(db, s, "select public.accept_staff_invite($1,'Staff') r", [si.code]);
const join = async (uid, name) => {
  const inv = R(await rpc(db, g, "select public.create_invite($1,'1') r", [name]));
  await rpc(db, uid, "select public.accept_invite($1,null,$2,'1') r", [inv.code, name]);
  return (await q(db, "select client_id from public.profiles where id=$1", [uid]))[0].client_id;
};
const cl1 = await join(c1, "Ana Clara");
const cl2 = await join(c2, "Bia Souza");
await rpc(db, other, "select public.create_clinic('Outra','1','Outro','RJ','','autonoma') r");
const oi = R(await rpc(db, other, "select public.create_invite('Zoe','1') r"));
await rpc(db, oc, "select public.accept_invite($1,null,'Zoe','1') r", [oi.code]);

await rpc(db, g, "select public.save_loyalty_config(true,false,null,null) r");
const give = (client, n) => rpc(db, g, "select public.award_manual($1,$2,'teste') r", [client, n]);
await give(cl1, 100);
await give(cl2, 20);

// ---- só a gestora cria prêmios
const noPerm = R(
  await rpc(db, s, "select public.save_reward(null,'Desconto',null,50,null,null,true) r"),
);
check("funcionária não cria prêmio", noPerm.reason === "sem_permissao");
check(
  "cliente não lê as tabelas de prêmios",
  (await denied(() => as(db, c1, () => q(db, "select * from public.rewards")))) &&
    (await denied(() => as(db, c1, () => q(db, "select * from public.redemptions")))),
);
const r1 = R(
  await rpc(
    db,
    g,
    "select public.save_reward(null,'Desconto de R$ 30','Na próxima limpeza',50,null,null,true) r",
  ),
);
const r2 = R(
  await rpc(
    db,
    g,
    "select public.save_reward(null,'Sessão cortesia','Massagem de 30 min',500,null,1,true) r",
  ),
);
const r3 = R(
  await rpc(db, g, "select public.save_reward(null,'Brinde','Kit de máscara',30,null,2,true) r"),
);
check("gestora cria prêmios", r1.ok && r2.ok && r3.ok);
check(
  "custo inválido é recusado",
  R(await rpc(db, g, "select public.save_reward(null,'x',null,0,null,null,true) r")).reason ===
    "custo_invalido",
);

// ---- cliente vê a vitrine
const mine = R(await rpc(db, c1, "select public.my_rewards() r"));
check(
  "cliente vê os prêmios e o saldo disponível",
  mine.enabled && mine.available === 100 && mine.rewards.length === 3,
  JSON.stringify(mine),
);
check(
  "prêmio caro aparece mas não dá para resgatar",
  mine.rewards.find((r) => r.name === "Sessão cortesia").can_redeem === false,
);
const other_ = R(await rpc(db, oc, "select public.my_rewards() r"));
check("cliente de outra clínica não vê estes prêmios", other_.enabled === false);

// ---- pedir resgate
const ask = R(await rpc(db, c1, "select public.request_redeem($1) r", [r1.id]));
check("cliente pede o resgate", ask.ok === true, JSON.stringify(ask));
check(
  "pontos reservados no pedido (saldo disponível cai, saldo real não)",
  R(await rpc(db, c1, "select public.my_rewards() r")).available === 50 &&
    Number(
      (
        await q(
          db,
          "select coalesce(sum(points),0) t from public.loyalty_ledger where client_id=$1",
          [cl1],
        )
      )[0].t,
    ) === 100,
);
check(
  "não pode pedir o mesmo prêmio duas vezes",
  R(await rpc(db, c1, "select public.request_redeem($1) r", [r1.id])).reason === "ja_pedido",
);
check(
  "sem pontos suficientes é recusado",
  R(await rpc(db, c1, "select public.request_redeem($1) r", [r2.id])).reason ===
    "pontos_insuficientes",
);
check(
  "não pede prêmio de outra clínica",
  ["premio_indisponivel", "programa_desligado"].includes(
    R(await rpc(db, oc, "select public.request_redeem($1) r", [r1.id])).reason,
  ),
);
const gnote = (
  await as(db, g, () => q(db, "select title, href from public.notifications where kind='redeem'"))
)[0];
check(
  "gestora recebe o aviso do pedido, com link para a fila",
  gnote?.title === "Pedido de resgate" && gnote.href === "/fidelidade?aba=premios",
  JSON.stringify(gnote),
);
check(
  "funcionária não recebe o aviso (só a gestora)",
  (await as(db, s, () => q(db, "select * from public.notifications where kind='redeem'")))
    .length === 0,
);

// ---- cancelar pedido pendente
const ask2 = R(await rpc(db, c1, "select public.request_redeem($1) r", [r3.id]));
check(
  "cliente cancela o próprio pedido pendente",
  R(await rpc(db, c1, "select public.cancel_my_redeem($1) r", [ask2.id])).ok === true,
);
check(
  "cliente não cancela pedido de outra",
  R(await rpc(db, c2, "select public.cancel_my_redeem($1) r", [ask.id])).reason ===
    "nao_encontrado",
);

// ---- a gestora decide
const adm = R(await rpc(db, g, "select public.rewards_admin() r"));
check(
  "gestora vê a fila com o pedido pendente primeiro",
  adm.redemptions[0].status === "pendente" && adm.redemptions[0].client === "Ana Clara",
  JSON.stringify(adm.redemptions[0]),
);
check(
  "funcionária e cliente não decidem",
  R(await rpc(db, s, "select public.decide_redeem($1,'aprovar') r", [ask.id])).reason ===
    "sem_permissao" &&
    R(await rpc(db, c1, "select public.decide_redeem($1,'aprovar') r", [ask.id])).reason ===
      "sem_permissao",
);
check(
  "outra gestora não decide pedido desta clínica",
  R(await rpc(db, other, "select public.decide_redeem($1,'aprovar') r", [ask.id])).reason ===
    "nao_encontrado",
);
const ok1 = R(await rpc(db, g, "select public.decide_redeem($1,'aprovar') r", [ask.id]));
check(
  "gestora aprova e os pontos saem",
  ok1.ok && R(await rpc(db, c1, "select public.my_rewards() r")).available === 50,
  JSON.stringify(ok1),
);
check(
  "aprovar duas vezes não desconta de novo",
  R(await rpc(db, g, "select public.decide_redeem($1,'aprovar') r", [ask.id])).reason ===
    "estado_invalido" && R(await rpc(db, c1, "select public.my_rewards() r")).available === 50,
);
const lvl = R(await rpc(db, c1, "select public.my_loyalty() r"));
check(
  "resgatar não rebaixa nível nem ranking (ganhos continuam)",
  lvl.earned === 100 && lvl.points === 50,
  JSON.stringify([lvl.earned, lvl.points]),
);
check(
  "cliente recebe o aviso de aprovação",
  (
    await as(db, c1, () => q(db, "select title from public.notifications where kind='redeem'"))
  ).some((n) => n.title === "Resgate aprovado"),
);
check(
  "marcar como entregue",
  R(await rpc(db, g, "select public.decide_redeem($1,'entregar') r", [ask.id])).ok === true,
);
check(
  "entregue não pode ser cancelado",
  R(await rpc(db, g, "select public.decide_redeem($1,'cancelar') r", [ask.id])).reason ===
    "estado_invalido",
);

// ---- recusar e cancelar aprovado devolvem
const ask3 = R(await rpc(db, c1, "select public.request_redeem($1) r", [r3.id]));
check(
  "recusar libera os pontos e avisa",
  R(await rpc(db, g, "select public.decide_redeem($1,'recusar') r", [ask3.id])).ok === true &&
    R(await rpc(db, c1, "select public.my_rewards() r")).available === 50,
);
const ask4 = R(await rpc(db, c1, "select public.request_redeem($1) r", [r3.id]));
await rpc(db, g, "select public.decide_redeem($1,'aprovar') r", [ask4.id]);
check(
  "estoque do brinde: aprovado conta no limite",
  R(await rpc(db, c1, "select public.my_rewards() r")).available === 20,
);
const cancelled = R(await rpc(db, g, "select public.decide_redeem($1,'cancelar') r", [ask4.id]));
check(
  "cancelar um aprovado devolve os pontos",
  cancelled.ok && R(await rpc(db, c1, "select public.my_rewards() r")).available === 50,
);

// ---- quantidade limitada
await give(cl1, 500);
await give(cl2, 600);
const a5 = R(await rpc(db, c1, "select public.request_redeem($1) r", [r2.id]));
check("prêmio de quantidade 1: primeiro pedido passa", a5.ok === true);
check(
  "depois dele, esgota para as outras",
  R(await rpc(db, c2, "select public.request_redeem($1) r", [r2.id])).reason === "premio_esgotado",
);
check(
  "prêmio esgotado some da vitrine",
  !R(await rpc(db, c2, "select public.my_rewards() r")).rewards.some(
    (r) => r.name === "Sessão cortesia",
  ),
);
check(
  "não exclui prêmio com pedido aberto",
  R(await rpc(db, g, "select public.delete_reward($1) r", [r2.id])).reason ===
    "tem_pedidos_abertos",
);
await rpc(db, g, "select public.decide_redeem($1,'recusar') r", [a5.id]);
check(
  "exclui prêmio sem pedido aberto",
  R(await rpc(db, g, "select public.delete_reward($1) r", [r2.id])).ok === true,
);

// ---- validade e desligado
await db.query("update public.rewards set valid_until = current_date - 1 where id = $1", [r3.id]);
check(
  "prêmio vencido sai da vitrine e não é resgatável",
  !R(await rpc(db, c1, "select public.my_rewards() r")).rewards.some((r) => r.name === "Brinde") &&
    R(await rpc(db, c1, "select public.request_redeem($1) r", [r3.id])).reason ===
      "premio_indisponivel",
);
await rpc(db, g, "select public.save_loyalty_config(false,false,null,null) r");
check(
  "programa desligado: nada de resgate",
  R(await rpc(db, c1, "select public.request_redeem($1) r", [r1.id])).reason ===
    "programa_desligado" && R(await rpc(db, c1, "select public.my_rewards() r")).enabled === false,
);

console.log(`\n${pass} ok, ${fail} falhas`);
process.exit(fail ? 1 : 0);
