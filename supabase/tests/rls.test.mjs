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
const rpc = async (db, uid, sql, p = []) => as(db, uid, async () => (await q(db, sql, p))[0]);

const db = await createDb();
const gX = await addUser(db, "gx@x.com"),
  gY = await addUser(db, "gy@y.com");
const c1 = await addUser(db, "c1@x.com"),
  c2 = await addUser(db, "c2@x.com"),
  c3 = await addUser(db, "c3@x.com");
const f1 = await addUser(db, "f1@x.com"),
  f2 = await addUser(db, "f2@x.com");
const unconf = await addUser(db, "nc@x.com", false);

const mk = (uid, studio) =>
  rpc(db, uid, "select public.create_clinic($1,$2,$3,$4,$5,$6) r", [
    "Dona",
    "11999",
    studio,
    "SP",
    "",
    "autonoma",
  ]).then((x) => x.r);

// --- clínica
check(
  "e-mail não confirmado não cria clínica",
  (await mk(unconf, "Studio NC")).reason === "email_nao_confirmado",
);
const cx = await mk(gX, "Estúdio Ação X");
check(
  "cria clínica X com slug sem acento",
  cx.ok && cx.slug === "estudio-acao-x",
  JSON.stringify(cx),
);
check("repetir create_clinic é idempotente", (await mk(gX, "Outro")).already === true);
const cy = await mk(gY, "Estúdio Ação X");
check("slug repetido ganha sufixo", cy.slug === "estudio-acao-x-2", JSON.stringify(cy));
check(
  "link público devolve só o nome",
  (
    await as(
      db,
      null,
      async () => (await q(db, "select public.get_clinic_public('estudio-acao-x') r"))[0].r,
    )
  ).name === "Estúdio Ação X",
);

// --- isolamento básico
check(
  "anônimo não lê clínicas",
  await denied(() => as(db, null, () => q(db, "select * from public.clinics"))),
);
check(
  "anônimo não lê clientes",
  await denied(() => as(db, null, () => q(db, "select * from public.clients"))),
);
check(
  "gestora X lê só a própria clínica",
  (await as(db, gX, () => q(db, "select id from public.clinics"))).length === 1,
);
check(
  "usuário não altera o próprio papel",
  await denied(() =>
    as(db, gX, () =>
      q(db, "update public.profiles set role='funcionario' where id=$1 returning id", [gX]),
    ),
  ),
);
check(
  "usuário não se cria perfil",
  await denied(() =>
    as(db, c3, () =>
      q(
        db,
        "insert into public.profiles (id, clinic_id, role, name) values ($1,$2,'gestor','x') returning id",
        [c3, cx.clinic_id],
      ),
    ),
  ),
);
check(
  "não altera slug da clínica",
  await denied(() => as(db, gX, () => q(db, "update public.clinics set slug='hack' returning id"))),
);

// --- credenciais de cliente
const inv = await rpc(db, gX, "select public.create_invite('Ana','11') r").then((x) => x.r);
check(
  "gestora gera credencial EB-XXXX-XXXX",
  inv.ok && /^EB(-[A-Z2-9]{4}){2}$/.test(inv.code),
  JSON.stringify(inv),
);
check(
  "só o hash fica no banco",
  (await q(db, "select count(*)::int n from public.invites where code_hash = $1", [inv.code])).at(0)
    .n === 0,
);
check(
  "credencial não é legível pela API",
  await denied(() => as(db, gX, () => q(db, "select * from public.invites"))),
);
const bad = await rpc(db, c1, "select public.accept_invite('EB-ZZZZ-ZZZZ',null,'Ana','11') r").then(
  (x) => x.r,
);
check("código errado devolve resposta genérica", bad.ok === false && bad.reason === "invalido");
const acc = await rpc(db, c1, "select public.accept_invite($1,null,'Ana Cliente','11') r", [
  inv.code,
]).then((x) => x.r);
check(
  "cliente entra por credencial",
  acc.ok === true && acc.clinic_id === cx.clinic_id,
  JSON.stringify(acc),
);
const again = await rpc(db, c2, "select public.accept_invite($1,null,'Outra','11') r", [
  inv.code,
]).then((x) => x.r);
check("credencial de uso único", again.ok === false && again.reason === "invalido");
let blocked = null;
for (let i = 0; i < 21; i++)
  blocked = await rpc(db, c3, "select public.accept_invite('EB-AAAA-AAAA',null,'x','1') r").then(
    (x) => x.r,
  );
check(
  "21 credenciais erradas bloqueiam a conta",
  blocked.reason === "bloqueado",
  JSON.stringify(blocked),
);
const viaLink = await rpc(
  db,
  c2,
  "select public.accept_invite('', 'estudio-acao-x', 'Bia Link','11') r",
).then((x) => x.r);
check("cliente entra pelo link fixo da clínica", viaLink.ok === true, JSON.stringify(viaLink));
check(
  "link com clínica inexistente falha",
  (
    await rpc(
      db,
      await addUser(db, "z@x.com"),
      "select public.accept_invite('', 'nao-existe', 'Z','1') r",
    ).then((x) => x.r)
  ).ok === false,
);
check(
  "gestora recebe aviso de nova cliente",
  (await as(db, gX, () => q(db, "select * from public.notifications where kind='followup'")))
    .length === 2,
);
check(
  "aviso não vaza para a gestora Y",
  (await as(db, gY, () => q(db, "select * from public.notifications"))).length === 0,
);

// --- credencial de equipe
const si = await rpc(db, gX, "select public.create_staff_invite('Fer','f1@x.com',$1::jsonb) r", [
  JSON.stringify({
    clientes: true,
    agenda: true,
    atendimentos: true,
    estoque: true,
    historico: true,
  }),
]).then((x) => x.r);
check(
  "credencial de equipe vale 48 h",
  si.ok && Math.abs(new Date(si.expires_at) - Date.now() - 48 * 3600e3) < 60e3,
);
check(
  "funcionária não cria credencial",
  (await rpc(db, f1, "select public.create_staff_invite('x','x@x.com','{}') r").then((x) => x.r))
    .reason === "sem_permissao",
);
check(
  "e-mail diferente do convite é recusado",
  (
    await rpc(db, f2, "select public.accept_staff_invite($1,'Intrusa') r", [si.code]).then(
      (x) => x.r,
    )
  ).ok === false,
);
const sa = await rpc(db, f1, "select public.accept_staff_invite($1,'Fer Equipe') r", [
  si.code,
]).then((x) => x.r);
check("funcionária entra com o e-mail do convite", sa.ok === true, JSON.stringify(sa));
check(
  "credencial de equipe é de uso único",
  (await rpc(db, f1, "select public.accept_staff_invite($1,'x') r", [si.code]).then((x) => x.r))
    .already === true,
);

// --- bloqueios de agenda: gestora e equipe com permissão de agenda gravam; cliente e outra clínica não
check(
  "funcionária com agenda cria bloqueio",
  (
    await as(db, f1, () =>
      q(
        db,
        "insert into public.blocks (clinic_id, date, start, \"end\", reason) select clinic_id, current_date, '12:00', '13:00', 'Almoço' from public.profiles where id = auth.uid() returning id",
      ),
    )
  ).length === 1,
);
check(
  "cliente não cria bloqueio",
  await denied(() =>
    as(db, c1, () =>
      q(
        db,
        "insert into public.blocks (clinic_id, date, start, \"end\") select clinic_id, current_date, '09:00', '10:00' from public.profiles where id = auth.uid() returning id",
      ),
    ),
  ),
);
check(
  "bloqueio não aparece para a gestora de outra clínica",
  (await as(db, gY, () => q(db, "select * from public.blocks"))).length === 0,
);

// --- dados de teste (inseridos como dono do banco) e permissões por papel
const cl1 = (await q(db, "select client_id from public.profiles where id=$1", [c1]))[0].client_id;
await db.query(
  "insert into public.ledger (clinic_id, kind, date, due, label, origin, value, client_id) values ($1,'receber',current_date,current_date,'Ana','Limpeza',180,$2)",
  [cx.clinic_id, cl1],
);
await db.query(
  "insert into public.ledger (clinic_id, kind, date, label, origin, value) values ($1,'entradas',current_date,'Outra','x',50)",
  [cx.clinic_id],
);
await db.query("insert into public.stock (clinic_id, name, quantity) values ($1,'Ácido',3)", [
  cx.clinic_id,
]);
const stockId = (await q(db, "select id from public.stock"))[0].id;
await db.query("insert into public.stock_costs (stock_id, clinic_id, cost) values ($1,$2,78)", [
  stockId,
  cx.clinic_id,
]);
await db.query(
  "insert into public.bills (clinic_id, name, value, due) values ($1,'Aluguel',900,current_date)",
  [cx.clinic_id],
);
await db.query("insert into public.clients (clinic_id, name) values ($1,'Cliente Y')", [
  cy.clinic_id,
]);

check(
  "gestora lê o caixa",
  (await as(db, gX, () => q(db, "select * from public.ledger"))).length === 2,
);
check(
  "funcionária NÃO lê o caixa",
  await denied(() => as(db, f1, () => q(db, "select * from public.ledger"))),
);
check(
  "funcionária NÃO lê contas",
  await denied(() => as(db, f1, () => q(db, "select * from public.bills"))),
);
check(
  "funcionária NÃO lê custo do estoque",
  await denied(() => as(db, f1, () => q(db, "select * from public.stock_costs"))),
);
check(
  "funcionária lê o estoque (sem custo)",
  (await as(db, f1, () => q(db, "select * from public.stock"))).length === 1,
);
check(
  "funcionária lê clientes da clínica",
  (await as(db, f1, () => q(db, "select * from public.clients"))).length === 2,
);
check(
  "funcionária não edita preço de procedimento",
  await denied(() =>
    as(db, f1, () =>
      q(db, "insert into public.procedures (clinic_id,name,price) values ($1,'x',1) returning id", [
        cx.clinic_id,
      ]),
    ),
  ),
);
check(
  "funcionária não lê eventos financeiros",
  (await as(db, f1, () => q(db, "select * from public.activity where sensitive"))).length === 0,
);
check(
  "cliente lê só a própria ficha",
  (await as(db, c1, () => q(db, "select * from public.clients"))).length === 1,
);
check(
  "cliente NÃO lê o caixa inteiro",
  (await as(db, c1, () => q(db, "select * from public.ledger"))).every(
    (r) => r.client_id === cl1 && r.kind === "receber",
  ),
);
check(
  "cliente vê só a própria cobrança",
  (await as(db, c1, () => q(db, "select * from public.ledger"))).length === 1,
);
check(
  "cliente não vê cobrança alheia",
  (await as(db, c2, () => q(db, "select * from public.ledger"))).length === 0,
);
check(
  "cliente não confirma o próprio pagamento",
  await denied(() =>
    as(db, c1, () => q(db, "update public.ledger set kind='entradas' returning id")),
  ),
);
check(
  "gestora Y não lê clientes da clínica X",
  (await as(db, gY, () => q(db, "select * from public.clients"))).every(
    (r) => r.clinic_id === cy.clinic_id,
  ),
);
check(
  "gestora Y não lê o caixa de X",
  (await as(db, gY, () => q(db, "select * from public.ledger"))).length === 0,
);

// --- cliente informa pagamento
const entry = (await q(db, "select id from public.ledger where kind='receber'"))[0].id;
check(
  "cliente alheia não informa pagamento",
  (await rpc(db, c2, "select public.report_payment($1,'Pix') r", [entry]).then((x) => x.r)).ok ===
    false,
);
const rp = await rpc(db, c1, "select public.report_payment($1,'Pix') r", [entry]).then((x) => x.r);
check("cliente informa pagamento", rp.ok === true, JSON.stringify(rp));
check(
  "gestora é avisada do pagamento",
  (await as(db, gX, () => q(db, "select * from public.notifications where kind='payment'")))
    .length === 1,
);
check(
  "funcionária NÃO é avisada de pagamento",
  (await as(db, f1, () => q(db, "select * from public.notifications where kind='payment'")))
    .length === 0,
);
check(
  "evento de pagamento é sensível",
  (await as(db, gX, () => q(db, "select * from public.activity where kind='pagamento'"))).every(
    (r) => r.sensitive,
  ),
);

// --- agenda
const goodReq =
  "insert into public.appointments (clinic_id, client_id, procedure, date, time, status, origin, request) values ($1,$2,'Limpeza', current_date+3, '10:00','pending','cliente',true) returning id";
check(
  "cliente cria pedido pendente",
  (await as(db, c1, () => q(db, goodReq, [cx.clinic_id, cl1]))).length === 1,
);
check(
  "cliente não cria horário confirmado",
  await denied(() =>
    as(db, c1, () =>
      q(
        db,
        "insert into public.appointments (clinic_id, client_id, procedure, date, time, status, origin, request) values ($1,$2,'x', current_date+4,'11:00','confirmed','cliente',true) returning id",
        [cx.clinic_id, cl1],
      ),
    ),
  ),
);
check(
  "cliente não cria horário para outra pessoa",
  await denied(() =>
    as(db, c1, () =>
      q(
        db,
        "insert into public.appointments (clinic_id, client_id, procedure, date, time, status, origin, request) values ($1,gen_random_uuid(),'x', current_date+5,'11:00','pending','cliente',true) returning id",
        [cx.clinic_id],
      ),
    ),
  ),
);
check(
  "horário ocupado é recusado pelo banco",
  await (async () => {
    try {
      await as(db, gX, () =>
        q(
          db,
          "insert into public.appointments (clinic_id, client_id, procedure, date, time, status) values ($1,$2,'x', current_date+3,'10:00','confirmed')",
          [cx.clinic_id, cl1],
        ),
      );
      return false;
    } catch {
      return true;
    }
  })(),
);
const ap = (await q(db, "select id from public.appointments"))[0].id;
const rr = await rpc(db, c1, "select public.request_reschedule($1, current_date+6, '15:00') r", [
  ap,
]).then((x) => x.r);
check("cliente pede remarcação", rr.ok === true);
const rc = await rpc(db, c1, "select public.request_cancel($1) r", [ap]).then((x) => x.r);
check(
  "cancelar com mais de 24 h é direto",
  rc.ok === true && rc.immediate === true,
  JSON.stringify(rc),
);

// --- permissões escolhidas pela gestora
const f3 = await addUser(db, "f3@x.com"),
  f4 = await addUser(db, "f4@x.com"),
  f5 = await addUser(db, "f5@x.com");
const mkStaff = async (uid, email, perms) => {
  const i = await rpc(db, gX, "select public.create_staff_invite('Equipe', $1, $2::jsonb) r", [
    email,
    JSON.stringify(perms),
  ]).then((x) => x.r);
  return rpc(db, uid, "select public.accept_staff_invite($1,'Equipe') r", [i.code]).then(
    (x) => x.r,
  );
};
check(
  "funcionária só com agenda entra",
  (await mkStaff(f3, "f3@x.com", { agenda: true })).ok === true,
);
check(
  "funcionária com financeiro entra",
  (await mkStaff(f4, "f4@x.com", { financeiro: true })).ok === true,
);
check(
  "credencial sem permissões entra sem acesso a nada",
  (await mkStaff(f5, "f5@x.com", { god: true, financeiro: "talvez" })).ok === true,
);
check(
  "permissões desconhecidas são ignoradas",
  (() => {
    return true;
  })() &&
    (await (async () => {
      const perms = (await q(db, "select permissions from public.profiles where id=$1", [f5]))[0]
        .permissions;
      return (
        Object.keys(perms).sort().join() ===
          "agenda,atendimentos,clientes,estoque,financeiro,historico" &&
        Object.values(perms).every((v) => v === false)
      );
    })()),
);
check(
  "agenda lê horários",
  (await as(db, f3, () => q(db, "select * from public.appointments"))).length >= 1,
);
check(
  "agenda lê nomes de clientes (só leitura)",
  (await as(db, f3, () => q(db, "select * from public.clients"))).length === 2,
);
check(
  "agenda NÃO cadastra clientes",
  await denied(() =>
    as(db, f3, () =>
      q(db, "insert into public.clients (clinic_id, name) values ($1,'Intrusa') returning id", [
        cx.clinic_id,
      ]),
    ),
  ),
);
check(
  "agenda NÃO lê estoque",
  await denied(() => as(db, f3, () => q(db, "select * from public.stock"))),
);
check(
  "agenda NÃO lê atendimentos",
  await denied(() => as(db, f3, () => q(db, "select * from public.sessions"))),
);
check(
  "agenda NÃO lê histórico",
  await denied(() => as(db, f3, () => q(db, "select * from public.activity"))),
);
check(
  "com permissão financeiro lê o caixa",
  (await as(db, f4, () => q(db, "select * from public.ledger"))).length === 2,
);
check(
  "com permissão financeiro lê contas e custos",
  (await as(db, f4, () => q(db, "select * from public.bills"))).length === 1 &&
    (await as(db, f4, () => q(db, "select * from public.stock_costs"))).length === 1,
);
check(
  "financeiro sozinho NÃO lê clientes",
  await denied(() => as(db, f4, () => q(db, "select * from public.clients"))),
);
await db.query(
  "insert into public.ledger (clinic_id, kind, date, due, label, origin, value, client_id) values ($1,'receber',current_date,current_date,'Ana','Retorno',90,$2)",
  [cx.clinic_id, cl1],
);
const entry2 = (await q(db, "select id from public.ledger where origin='Retorno'"))[0].id;
await rpc(db, c1, "select public.report_payment($1,'Pix') r", [entry2]);
check(
  "com financeiro recebe aviso de pagamento novo",
  (await as(db, f4, () => q(db, "select * from public.notifications where kind='payment'")))
    .length === 1,
);
check(
  "sem financeiro não recebe aviso de pagamento",
  (await as(db, f3, () => q(db, "select * from public.notifications where kind='payment'")))
    .length === 0,
);
check(
  "sem permissões não lê nada",
  (await denied(() => as(db, f5, () => q(db, "select * from public.clients")))) &&
    (await denied(() => as(db, f5, () => q(db, "select * from public.appointments")))),
);
check(
  "funcionária não altera permissões",
  (
    await rpc(db, f3, "select public.set_staff_permissions($1,'{\"financeiro\":true}') r", [
      f3,
    ]).then((x) => x.r)
  ).reason === "sem_permissao",
);
check(
  "gestora concede permissão e vale na hora",
  (
    await rpc(
      db,
      gX,
      'select public.set_staff_permissions($1,\'{"agenda":true,"estoque":true}\') r',
      [f3],
    ).then((x) => x.r)
  ).ok === true && (await as(db, f3, () => q(db, "select * from public.stock"))).length === 1,
);
check(
  "gestora retira permissão e vale na hora",
  (
    await rpc(db, gX, "select public.set_staff_permissions($1,'{\"agenda\":true}') r", [f3]).then(
      (x) => x.r,
    )
  ).ok === true && (await denied(() => as(db, f3, () => q(db, "select * from public.stock")))),
);
check(
  "gestora Y não altera permissões da equipe de X",
  (
    await rpc(db, gY, "select public.set_staff_permissions($1,'{\"financeiro\":true}') r", [
      f3,
    ]).then((x) => x.r)
  ).ok === false,
);
check(
  "lista de credenciais mostra permissões, nunca o código",
  (await as(db, gX, () => q(db, "select * from public.list_invites()"))).every(
    (r) => r.permissions !== undefined && !("code_hash" in r),
  ),
);

// --- desativar funcionária
const sd = await rpc(db, gX, "select public.set_staff_active($1,false) r", [f1]).then((x) => x.r);
check("gestora desativa funcionária", sd.ok === true);
check(
  "funcionária desativada perde o acesso na hora",
  await denied(() => as(db, f1, () => q(db, "select * from public.clients"))),
);
check(
  "só a gestora desativa",
  (await rpc(db, c1, "select public.set_staff_active($1,true) r", [f1]).then((x) => x.r)).ok ===
    false,
);

// --- auditoria imutável e avisos
check(
  "ninguém escreve em activity direto",
  await denied(() =>
    as(db, gX, () =>
      q(
        db,
        "insert into public.activity (clinic_id, by_role, kind, text) values ($1,'gestor','equipe','x') returning id",
        [cx.clinic_id],
      ),
    ),
  ),
);
check(
  "avisos só permitem marcar como lido",
  await denied(() =>
    as(db, gX, () => q(db, "update public.notifications set title='x' returning id")),
  ),
);
check(
  "avisos podem ser marcados como lidos",
  (await as(db, gX, () => q(db, "update public.notifications set read=true returning id")))
    .length >= 1,
);
check(
  "segredo interno inacessível",
  await denied(() => as(db, gX, () => q(db, "select * from app.secrets"))),
);
check(
  "anon não executa funções de clínica",
  await denied(() => as(db, null, () => q(db, "select public.create_invite('x','y')"))),
);

// --- toda tabela pública tem RLS
const noRls = await q(
  db,
  "select tablename from pg_tables where schemaname='public' and not rowsecurity",
);
check("TODA tabela pública tem RLS ligado", noRls.length === 0, JSON.stringify(noRls));

// o link fixo nunca bloqueia: muitas tentativas erradas e depois uma certa
const retry = await addUser(db, "retry@x.com");
let lastBad = null;
for (let i = 0; i < 30; i++)
  lastBad = await rpc(db, retry, "select public.accept_invite('', 'nao-existe', 'R','1') r").then(
    (x) => x.r,
  );
check("link inexistente só devolve inválido, sem bloquear", lastBad.reason === "invalido");
check(
  "depois de muitos erros, o link certo ainda funciona",
  (
    await rpc(db, retry, "select public.accept_invite('', 'estudio-acao-x', 'Rita','1') r").then(
      (x) => x.r,
    )
  ).ok === true,
);
check(
  "quem errou muitas credenciais ainda entra pelo link da clínica",
  (
    await rpc(db, c3, "select public.accept_invite('', 'estudio-acao-x', 'Cris','1') r").then(
      (x) => x.r,
    )
  ).ok === true,
);

console.log(`\n${pass} ok, ${fail} falhas`);
process.exit(fail ? 1 : 0);
