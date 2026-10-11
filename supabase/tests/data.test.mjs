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
  c = await addUser(db, "c@x.com"),
  c2 = await addUser(db, "c2@x.com");
const clinic = R(
  await rpc(db, g, "select public.create_clinic('Dona','1','Studio','SP','','autonoma') r"),
);
const cid = clinic.clinic_id;
const si = R(
  await rpc(db, g, "select public.create_staff_invite('S','s@x.com',$1::jsonb) r", [
    JSON.stringify({ clientes: true, agenda: true, atendimentos: true, estoque: true }),
  ]),
);
await rpc(db, s, "select public.accept_staff_invite($1,'Staff') r", [si.code]);
const ci = R(await rpc(db, g, "select public.create_invite('Cli','1') r"));
await rpc(db, c, "select public.accept_invite($1,null,'Cliente Um','1') r", [ci.code]);
const ci2 = R(await rpc(db, g, "select public.create_invite('Cli2','1') r"));
await rpc(db, c2, "select public.accept_invite($1,null,'Cliente Dois','1') r", [ci2.code]);
const clientId = (await q(db, "select client_id from public.profiles where id=$1", [c]))[0]
  .client_id;
const client2 = (await q(db, "select client_id from public.profiles where id=$1", [c2]))[0]
  .client_id;

await db.query("insert into public.procedures (clinic_id, name, price) values ($1,'Limpeza',180)", [
  cid,
]);
const stockId = (
  await db.query(
    "insert into public.stock (clinic_id, name, quantity, min, unit) values ($1,'Ácido',5,2,'fr') returning id",
    [cid],
  )
).rows[0].id;
await db.query("insert into public.stock_costs (stock_id, clinic_id, cost) values ($1,$2,10)", [
  stockId,
  cid,
]);

const draft = async (uid, data) =>
  (
    await as(db, uid, () =>
      q(
        db,
        "insert into public.sessions (clinic_id, client_id, procedure, data) values ($1,$2,'Limpeza',$3::jsonb) returning id",
        [cid, clientId, JSON.stringify(data)],
      ),
    )
  )[0].id;

// ---- funcionária sem financeiro fecha atendimento: o preço vale o da tabela, e o dinheiro fica "a receber"
const d1 = await draft(s, {
  client: "Cliente Um",
  procedures: [{ name: "Limpeza", price: 999 }],
  products: [{ stockId, name: "Ácido", qty: 2 }],
  payment: "Pix",
  paidNow: true,
});
const done1 = R(
  await rpc(db, s, "select public.complete_session($1,$2::jsonb,$3::jsonb) r", [
    d1,
    JSON.stringify(["Protetor solar todas as manhãs", "Evitar esfoliação"]),
    JSON.stringify({ data: "2099-01-10", hora: "14:00" }),
  ]),
);
check("funcionária fecha o atendimento", done1.ok === true, JSON.stringify(done1));
const led = await q(db, "select * from public.ledger where ref_id=$1", [d1]);
check(
  "preço da funcionária é o de tabela (não o digitado)",
  Number(led[0]?.value) === 180,
  JSON.stringify(led),
);
check("sem permissão financeira, o valor fica a receber", led[0]?.kind === "receber");
check(
  "estoque baixou",
  Number((await q(db, "select quantity from public.stock"))[0].quantity) === 3,
);
check(
  "sessão ficou finalizada sem dinheiro nos dados",
  (await q(db, "select status, data from public.sessions where id=$1", [d1]))[0].status ===
    "done" &&
    JSON.stringify(
      (await q(db, "select data from public.sessions where id=$1", [d1]))[0].data,
    ).includes("999") === false,
);
check(
  "funcionária NÃO lê o financeiro da sessão",
  await denied(() => as(db, s, () => q(db, "select * from public.session_finance"))),
);
check(
  "gestora lê o financeiro da sessão",
  (await as(db, g, () => q(db, "select * from public.session_finance"))).length === 1,
);
check(
  "horário foi criado como realizado",
  (await q(db, "select done, client_name from public.appointments where done"))[0]?.client_name ===
    "Cliente Um",
);
check(
  "cuidados criados com lembrete da manhã",
  (
    await q(db, "select reminder_time from public.care where text like 'Protetor%'")
  )[0]?.reminder_time?.startsWith("08:00"),
);
check(
  "retorno ficou aguardando confirmação",
  (await q(db, "select status from public.appointments where not done"))[0]?.status === "pending",
);
check(
  "cliente recebeu o aviso de cuidados e de retorno",
  (await as(db, c, () => q(db, "select * from public.notifications"))).length === 2,
);
check(
  "ficha da cliente marca a última visita",
  (await q(db, "select last_visit from public.clients where id=$1", [clientId]))[0].last_visit !==
    null,
);
check(
  "fechar duas vezes não duplica",
  R(await rpc(db, s, "select public.complete_session($1,'[]','null') r", [d1])).already === true &&
    (await q(db, "select * from public.ledger where ref_id=$1", [d1])).length === 1,
);
check(
  "cliente não fecha atendimento",
  R(await rpc(db, c, "select public.complete_session($1,'[]','null') r", [d1])).ok === false,
);

// ---- gestora fecha com preço dela e pago na hora
const d2 = await draft(g, {
  client: "Cliente Um",
  procedures: [{ name: "Limpeza", price: 250 }],
  products: [{ stockId, name: "Ácido", qty: 1 }],
  payment: "Cartão",
  paidNow: true,
});
check(
  "gestora fecha com preço próprio",
  R(await rpc(db, g, "select public.complete_session($1,'[]','null') r", [d2])).ok === true,
);
const l2 = (await q(db, "select * from public.ledger where ref_id=$1", [d2]))[0];
check(
  "entrada paga com o valor da gestora",
  l2.kind === "entradas" && Number(l2.value) === 250 && l2.method === "Cartão",
);
check(
  "estoque baixo gera aviso para a gestora",
  (await as(db, g, () => q(db, "select * from public.notifications where title='Estoque baixo'")))
    .length === 1,
);
check(
  "aviso de estoque chega à funcionária com permissão de estoque",
  (await as(db, s, () => q(db, "select * from public.notifications where title='Estoque baixo'")))
    .length === 1,
);

// ---- corrigir e apagar
check(
  "funcionária corrige notas mas não o valor",
  R(
    await rpc(db, s, "select public.edit_finished_session($1,$2::jsonb,$3::jsonb,'Pix') r", [
      d2,
      JSON.stringify([{ name: "Limpeza", price: 1 }]),
      JSON.stringify({ avaliacao: "ok" }),
    ]),
  ).ok === true &&
    Number((await q(db, "select value from public.ledger where ref_id=$1", [d2]))[0].value) === 250,
);
check(
  "gestora corrige o valor e o caixa acompanha",
  R(
    await rpc(db, g, "select public.edit_finished_session($1,$2::jsonb,'{}'::jsonb,'Pix') r", [
      d2,
      JSON.stringify([{ name: "Limpeza", price: 300 }]),
    ]),
  ).ok === true &&
    Number((await q(db, "select value from public.ledger where ref_id=$1", [d2]))[0].value) === 300,
);
check(
  "funcionária não apaga atendimento",
  R(await rpc(db, s, "select public.delete_finished_session($1) r", [d2])).ok === false,
);
const del = R(await rpc(db, g, "select public.delete_finished_session($1) r", [d2]));
check(
  "gestora apaga: sai do caixa e o estoque volta",
  del.ok === true &&
    (await q(db, "select * from public.ledger where ref_id=$1", [d2])).length === 0 &&
    Number((await q(db, "select quantity from public.stock"))[0].quantity) === 3,
);

// ---- avisos por função
check(
  "cliente avisa a equipe",
  R(
    await rpc(
      db,
      c,
      "select public.push_notification('gestor',null,'request','Pedido','x','/agenda',null,'agenda') r",
    ),
  ).ok === true,
);
check(
  "cliente não avisa outra cliente",
  R(
    await rpc(
      db,
      c,
      "select public.push_notification('cliente',$1,'reminder','Oi','x',null,null,null) r",
      [client2],
    ),
  ).ok === false,
);
check(
  "cliente avisa a si mesma",
  R(
    await rpc(
      db,
      c,
      "select public.push_notification('cliente',$1,'reminder','Lembrete','x',null,'r1',null) r",
      [clientId],
    ),
  ).ok === true,
);
check(
  "equipe avisa a cliente",
  R(
    await rpc(
      db,
      s,
      "select public.push_notification('cliente',$1,'confirmed','Horário confirmado','x',null,null,null) r",
      [client2],
    ),
  ).ok === true,
);
check(
  "aviso chegou só para quem devia",
  (
    await as(db, c2, () =>
      q(db, "select * from public.notifications where title='Horário confirmado'"),
    )
  ).length === 1 &&
    (
      await as(db, c, () =>
        q(db, "select * from public.notifications where title='Horário confirmado'"),
      )
    ).length === 0,
);
check(
  "regra repetida não duplica",
  (await rpc(
    db,
    c,
    "select public.push_notification('cliente',$1,'reminder','Lembrete','x',null,'r1',null) r",
    [clientId],
  ),
  (await as(db, c, () => q(db, "select * from public.notifications where title='Lembrete'")))
    .length === 1),
);
check(
  "público inválido é recusado",
  R(await rpc(db, s, "select public.push_notification('todos',null,'x','y','z',null,null,null) r"))
    .ok === false,
);

// ---- histórico
check(
  "cliente registra o próprio horário",
  R(
    await rpc(db, c, "select public.log_activity('horario',$1,'Confirmou presença',false) r", [
      clientId,
    ]),
  ).ok === true,
);
check(
  "cliente não registra cadastro nem em nome de outra",
  R(await rpc(db, c, "select public.log_activity('cadastro',$1,'x',false) r", [clientId])).ok ===
    false &&
    R(await rpc(db, c, "select public.log_activity('horario',$1,'x',false) r", [client2])).ok ===
      false,
);
check(
  "histórico guarda o nome da cliente",
  (
    await as(db, g, () =>
      q(db, "select client_name from public.activity where text='Confirmou presença'"),
    )
  )[0]?.client_name === "Cliente Um",
);

// ---- mapa facial
await db.query(
  "insert into public.face_maps (client_id, clinic_id, marks) values ($1,$2,$3::jsonb)",
  [
    clientId,
    cid,
    JSON.stringify([{ zona: "testa", procedimento: "Peeling", observacao: "interno: alergia" }]),
  ],
);
const mine = R(await rpc(db, c, "select public.my_face_map() r"));
check(
  "cliente vê o mapa sem observações internas",
  mine.length === 1 && mine[0].observacao === undefined && mine[0].procedimento === "Peeling",
);
check(
  "cliente não lê a tabela do mapa",
  await denied(() => as(db, c, () => q(db, "select * from public.face_maps"))),
);
check(
  "equipe lê o mapa completo",
  (await as(db, s, () => q(db, "select * from public.face_maps")))[0].marks[0].observacao ===
    "interno: alergia",
);
check(
  "outra cliente não vê o mapa de ninguém",
  R(await rpc(db, c2, "select public.my_face_map() r")).length === 0,
);

// ---- fotos (Storage + tabela photos)
const mkPath = (cl, f = "foto.jpg") => `${cid}/${cl}/${f}`;
const photoRow = async (cl, file, authorized, origem = "profissional") =>
  db.query(
    "insert into public.photos (clinic_id, client_id, storage_path, authorized, origem) values ($1,$2,$3,$4,$5)",
    [cid, cl, mkPath(cl, file), authorized, origem],
  );
await db.query(
  "insert into storage.objects (bucket_id, name) values ('photos',$1),('photos',$2),('photos',$3)",
  [
    mkPath(clientId, "interna.jpg"),
    mkPath(clientId, "autorizada.jpg"),
    mkPath(client2, "outra.jpg"),
  ],
);
await photoRow(clientId, "interna.jpg", false);
await photoRow(clientId, "autorizada.jpg", true);
await photoRow(client2, "outra.jpg", true);
check(
  "bucket de fotos é privado",
  (await q(db, "select public from storage.buckets where id='photos'"))[0].public === false,
);
check(
  "equipe lê as fotos da clínica",
  (await as(db, s, () => q(db, "select * from storage.objects"))).length === 3,
);
check(
  "cliente só lê a foto que foi autorizada para ela",
  (await as(db, c, () => q(db, "select name from storage.objects"))).map((r) => r.name).join() ===
    mkPath(clientId, "autorizada.jpg"),
);
check(
  "cliente vê no banco só as fotos autorizadas",
  (await as(db, c, () => q(db, "select * from public.photos"))).length === 1,
);
check(
  "cliente não grava foto como profissional",
  await denied(() =>
    as(db, c, () =>
      q(
        db,
        "insert into public.photos (clinic_id, client_id, storage_path, authorized, origem) values ($1,$2,'x',true,'profissional') returning id",
        [cid, clientId],
      ),
    ),
  ),
);
check(
  "cliente envia a própria foto",
  (
    await as(db, c, () =>
      q(
        db,
        "insert into public.photos (clinic_id, client_id, storage_path, authorized, origem) values ($1,$2,$3,false,'cliente') returning id",
        [cid, clientId, mkPath(clientId, "dela.jpg")],
      ),
    )
  ).length === 1 &&
    (
      await as(db, c, () =>
        q(db, "insert into storage.objects (bucket_id, name) values ('photos',$1) returning id", [
          mkPath(clientId, "dela.jpg"),
        ]),
      )
    ).length === 1,
);
check(
  "cliente enxerga a própria foto enviada",
  (await as(db, c, () => q(db, "select name from storage.objects where name like '%dela.jpg'")))
    .length === 1,
);
check(
  "cliente não envia arquivo na pasta de outra",
  await denied(() =>
    as(db, c, () =>
      q(db, "insert into storage.objects (bucket_id, name) values ('photos',$1) returning id", [
        mkPath(client2, "invasao.jpg"),
      ]),
    ),
  ),
);
check(
  "cliente não apaga foto da equipe",
  await denied(() =>
    as(db, c, () => q(db, "delete from public.photos where origem='profissional' returning id")),
  ),
);
check(
  "equipe grava foto na própria clínica",
  (
    await as(db, s, () =>
      q(db, "insert into storage.objects (bucket_id, name) values ('photos',$1) returning id", [
        mkPath(clientId, "y.jpg"),
      ]),
    )
  ).length === 1,
);
check(
  "equipe não grava em outra clínica",
  await denied(() =>
    as(db, s, () =>
      q(db, "insert into storage.objects (bucket_id, name) values ('photos',$1) returning id", [
        `outra-clinica/${clientId}/z.jpg`,
      ]),
    ),
  ),
);
check(
  "confirmar presença: só a cliente dona",
  await (async () => {
    const ap = (
      await db.query(
        "insert into public.appointments (clinic_id, client_id, client_name, procedure, date, time, status) values ($1,$2,'Cliente Um','x', current_date+30,'09:00','pending') returning id",
        [cid, clientId],
      )
    ).rows[0].id;
    return (
      R(await rpc(db, c2, "select public.confirm_my_appointment($1) r", [ap])).ok === false &&
      R(await rpc(db, c, "select public.confirm_my_appointment($1) r", [ap])).ok === true
    );
  })(),
);

// conta da cliente criada pela gestora (a Edge Function chama client_access_event com a chave de serviço)
const paulaId = (
  await db.query(
    "insert into public.clients (clinic_id, name, phone, email) values ($1,'Paula Andrade','11',null) returning id",
    [cid],
  )
).rows[0].id;
const paulaUser = await addUser(db, "paula@x.com");
const linked = (
  await q(db, "select public.client_access_event('create',$1,$2,'Paula@X.com',$3,'gestor') r", [
    paulaUser,
    paulaId,
    g,
  ])
)[0].r;
check("conta criada pela gestora é ligada à ficha", linked.ok === true, JSON.stringify(linked));
const paulaProfile = (
  await q(db, "select role, client_id, name, email from public.profiles where id=$1", [paulaUser])
)[0];
check(
  "perfil nasce como cliente, com o nome da ficha e e-mail em minúsculas",
  paulaProfile.role === "cliente" &&
    paulaProfile.client_id === paulaId &&
    paulaProfile.name === "Paula Andrade" &&
    paulaProfile.email === "paula@x.com",
  JSON.stringify(paulaProfile),
);
check(
  "ficha passa a ter o login e o e-mail",
  (await q(db, "select user_id, email from public.clients where id=$1", [paulaId]))[0].user_id ===
    paulaUser,
);
check(
  "a cliente já entra vendo só os próprios dados",
  (await as(db, paulaUser, () => q(db, "select id from public.clients"))).length === 1,
);
check(
  "cliente recebe o aviso de acesso pronto",
  (await as(db, paulaUser, () => q(db, "select title from public.notifications"))).some(
    (row) => row.title === "Seu acesso está pronto",
  ),
);
check(
  "segunda criação para a mesma ficha é recusada",
  (
    await q(db, "select public.client_access_event('create',$1,$2,'p2@x.com',$3,'gestor') r", [
      await addUser(db, "p2@x.com"),
      paulaId,
      g,
    ])
  )[0].r.reason === "ja_tem_acesso",
);
check(
  "o registro de atividade guarda o acesso criado, sem senha",
  (
    await q(
      db,
      "select text from public.activity where client_id=$1 and text like 'Acesso ao app%'",
      [paulaId],
    )
  ).length === 1,
);
check(
  "gestora e cliente não chamam a função direto pela API",
  (await denied(() =>
    as(db, g, () =>
      q(db, "select public.client_access_event('create',$1,$2,'x@x.com',$1,'gestor')", [
        g,
        paulaId,
      ]),
    ),
  )) &&
    (await denied(() =>
      as(db, paulaUser, () =>
        q(db, "select public.client_access_event('reset',$1,$2,'x@x.com',$1,'gestor')", [
          paulaUser,
          paulaId,
        ]),
      ),
    )),
);

check(
  "conta criada pela gestora nasce sem aceite; a cliente aceita no primeiro acesso",
  (await q(db, "select terms_accepted_at from public.profiles where id=$1", [paulaUser]))[0]
    .terms_accepted_at === null &&
    R(await rpc(db, paulaUser, "select public.accept_terms() r")).ok === true &&
    (
      await q(db, "select terms_accepted_at, terms_version from public.profiles where id=$1", [
        paulaUser,
      ])
    )[0].terms_version === "v1",
);

console.log(`\n${pass} ok, ${fail} falhas`);
process.exit(fail ? 1 : 0);
