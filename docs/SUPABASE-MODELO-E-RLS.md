# Modelo do banco (Postgres) e políticas RLS

Projeto. Mapeia os stores locais de `src/data/db.ts` e os tipos de `src/lib/models.ts` para tabelas do Supabase. Vale com a decisão de equipe: [Equipe e permissões](./EQUIPE-E-PERMISSOES.md). Convenções: `id uuid` com `gen_random_uuid()`, dinheiro em `numeric(12,2)`, datas só-dia em `date`, instantes em `timestamptz`, tudo em `snake_case`, toda tabela de clínica com `clinic_id` e `created_at`/`updated_at`.

## 1. Tabelas

```
clinics            id, slug (único), name, owner_id, email, phone, city, document, size
profiles           id (= auth.users.id), clinic_id, role ('gestor'|'funcionario'|'cliente'),
                   client_id?, name, email, active, terms_accepted_at, terms_version
clients            id, clinic_id, user_id?, name, phone, email, birth, document, address, goal,
                   allergies, contra, note, main_procedure, image_consent, image_consent_at
anamnesis          client_id (pk), clinic_id, answers jsonb, consent, updated_at
photos             id, clinic_id, client_id, session_id?, tipo ('antes'|'depois'?), procedure,
                   taken_at, authorized, storage_path
care               id, clinic_id, client_id, text, reminder_time, until
appointments       id, clinic_id, client_id, procedure, date, time, duration, status, kind, origin,
                   request, reschedule, proposed_date, proposed_time, cancel_request, done, notes
appointment_finance appt_id (pk), clinic_id, price, payment                -- SÓ gestora
sessions           id, clinic_id, appt_id?, client_id, procedure, step, status ('draft'|'done'),
                   notes jsonb, before_photo_id?, after_photo_id?, started_at, finished_at, staff_id
session_procedures session_id, name                 -- parte clínica
session_products   session_id, stock_id, name, qty  -- parte clínica
session_finance    session_id (pk), clinic_id, items jsonb [{name, price}], paid_now, payment,
                   due_date, cost_total             -- SÓ gestora
ledger             id, clinic_id, kind ('entradas'|'saidas'|'receber'), date, due, label, origin,
                   method, value, client_id?, ref_id?, reported jsonb?      -- SÓ gestora (+ cliente: própria)
bills              id, clinic_id, name, value, due, recurrence, paid         -- SÓ gestora
stock              id, clinic_id, name, category, quantity, unit, min, expiry, batch
stock_costs        stock_id (pk), clinic_id, cost, supplier                  -- SÓ gestora
procedures         id, clinic_id, name, price, duration, return_days         -- leitura: equipe; escrita: gestora
blocks             id, clinic_id, date, start, "end", reason
clinic_config      clinic_id (pk), hours jsonb, settings jsonb, payment_info text
notifications      id, clinic_id, recipient_id (uuid do usuário), rule_key, kind, title, body, href, read, created_at
                   unique (recipient_id, rule_key)  -- impede duplicar
activity           id, clinic_id, at, by_role, actor_id, kind, client_id?, text, sensitive
invites            code_hash (pk), clinic_id, role ('cliente'|'funcionario'), email_hint?, name_hint?,
                   expires_at, used_at?, used_by?, revoked, created_by
invite_attempts    id, user_id, at, ok            -- limite de tentativas
push_tokens        user_id, token (pk), platform, created_at
prefs              user_id (pk), data jsonb
```

Por que dividir `sessions` / `session_finance` e `stock` / `stock_costs`: o RLS protege **linhas**, não colunas. Para a funcionária nunca ver dinheiro, o dado financeiro vive em **tabelas que ela não pode ler**. O mesmo vale para o valor combinado do horário: fica em `appointment_finance`. A funcionária vê o preço de **tabela** dos procedimentos (`procedures`), mas não valores combinados, cobrados ou recebidos.

O que hoje é texto calculado (`lastVisit`, `nextReturn`, `age`, `status` do cliente) vira **view** ou campo derivado; a tela formata.

## 2. Funções auxiliares (nunca confiar no navegador)

```sql
create schema if not exists app;

create function app.me() returns profiles
language sql stable security definer set search_path = public as
$$ select * from profiles where id = auth.uid() and active $$;

create function app.clinic_id() returns uuid language sql stable security definer set search_path = public as
$$ select clinic_id from profiles where id = auth.uid() and active $$;

create function app.role() returns text language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() and active $$;

create function app.client_id() returns uuid language sql stable security definer set search_path = public as
$$ select client_id from profiles where id = auth.uid() and active $$;

create function app.is_gestor() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(app.role() = 'gestor', false) $$;

create function app.is_team() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(app.role() in ('gestor','funcionario'), false) $$;
```

Como as funções leem `profiles` (e `active`), **desativar uma pessoa bloqueia o acesso imediatamente**. `profiles` tem índice em `id`. Usuário **não pode** inserir/atualizar `profiles` (nenhuma política de escrita); só as RPCs.

## 3. Políticas RLS (rascunho)

> Rascunho de projeto; será ajustado e coberto por testes pgTAP. Regra: **RLS ligado e forçado em tudo** e nenhuma política = nada permitido.

```sql
alter table clients enable row level security;   -- o dono do banco (postgres) ignora RLS; as funções SECURITY DEFINER dependem disso

-- equipe lê e escreve clientes da própria clínica
create policy clients_team on clients for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_team())
  with check (clinic_id = app.clinic_id() and app.is_team());

-- cliente lê a própria ficha e atualiza só campos pessoais (via RPC update_my_profile)
create policy clients_self_read on clients for select to authenticated
  using (clinic_id = app.clinic_id() and app.role() = 'cliente' and id = app.client_id());

-- agenda
create policy appt_team on appointments for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_team())
  with check (clinic_id = app.clinic_id() and app.is_team());
create policy appt_client_read on appointments for select to authenticated
  using (clinic_id = app.clinic_id() and app.role() = 'cliente' and client_id = app.client_id());
create policy appt_client_request on appointments for insert to authenticated
  with check (clinic_id = app.clinic_id() and app.role() = 'cliente' and client_id = app.client_id()
              and status = 'pending' and origin = 'cliente');
-- pedir cancelar/remarcar: RPC request_cancel / request_reschedule (só altera esses campos)

-- financeiro: só gestora; cliente lê e "informa" a própria cobrança via RPC
create policy ledger_gestor on ledger for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor())
  with check (clinic_id = app.clinic_id() and app.is_gestor());
create policy ledger_client_read on ledger for select to authenticated
  using (clinic_id = app.clinic_id() and app.role() = 'cliente' and client_id = app.client_id() and kind = 'receber');
-- report_payment(entry_id, method): RPC que só preenche "reported" na própria cobrança

-- bills, stock_costs, session_finance, appointment_finance: mesma ideia, só is_gestor()
create policy bills_gestor on bills for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor()) with check (clinic_id = app.clinic_id() and app.is_gestor());

-- estoque: equipe lê/escreve (sem custo, que está em stock_costs)
create policy stock_team on stock for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_team()) with check (clinic_id = app.clinic_id() and app.is_team());

-- procedimentos: equipe e cliente leem; só a gestora escreve
create policy proc_read on procedures for select to authenticated using (clinic_id = app.clinic_id());
create policy proc_write on procedures for all to authenticated
  using (clinic_id = app.clinic_id() and app.is_gestor()) with check (clinic_id = app.clinic_id() and app.is_gestor());

-- avisos: cada um lê e marca como lida os próprios
create policy notif_own on notifications for select to authenticated using (recipient_id = auth.uid());
create policy notif_mark on notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
revoke update on notifications from authenticated;
grant update (read) on notifications to authenticated;   -- só a coluna "read"

-- auditoria: equipe lê (funcionária sem eventos financeiros); ninguém escreve direto
create policy activity_read on activity for select to authenticated
  using (clinic_id = app.clinic_id() and (app.is_gestor() or (app.role() = 'funcionario' and not sensitive)));
revoke insert, update, delete on activity from authenticated;

-- credenciais: nenhuma política (inacessível ao navegador); só RPC
alter table invites enable row level security; alter table invites force row level security;
```

Pontos a refinar nos testes: leitura de `sessions` finalizadas (funcionária lê parte clínica, nunca `session_finance`), limite de colunas editáveis por papel (`grant update (colunas)`), impedir listagem ampla do papel cliente sem filtro, e `with check` em todos os `insert/update`.

### Storage (fotos)

Bucket privado `photos`; caminho `{clinic_id}/{client_id}/{arquivo}`.

```sql
create policy photos_team on storage.objects for all to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = app.clinic_id()::text and app.is_team())
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = app.clinic_id()::text and app.is_team()
              and (metadata->>'size')::int < 5242880);

create policy photos_client_read on storage.objects for select to authenticated
  using (bucket_id = 'photos' and app.role() = 'cliente'
         and (storage.foldername(name))[2] = app.client_id()::text
         and exists (select 1 from clients c where c.id = app.client_id() and c.image_consent));
```

Tipo e tamanho do arquivo também são limitados nas configurações do bucket (somente `image/jpeg|png|webp`, até 5 MB).

## 4. RPCs (resumo do contrato)

Todas `SECURITY DEFINER`, `set search_path = public`, validam `auth.uid()`, papel e clínica **dentro** da função, e recebem `request_id` para idempotência.

| RPC                                                        | Quem                      | O que faz                                                                         |
| ---------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------- |
| `create_clinic(studio, city, document, size)`              | usuário recém-criado      | Cria `clinics` + `profiles(role=gestor)` + `clinic_config`                        |
| `create_invite(name_hint, phone_hint)`                     | gestora                   | Gera código, grava só o hash, devolve o código **uma vez**                        |
| `create_staff_invite(name, email)`                         | gestora                   | Idem, `role=funcionario`, 48 h, amarrado ao e-mail                                |
| `accept_invite(code_or_slug, data)`                        | usuário recém-criado      | Valida, cria `clients` + `profiles(role=cliente)`, avisa                          |
| `accept_staff_invite(code)`                                | usuário recém-criado      | Valida e cria `profiles(role=funcionario)`                                        |
| `disable_staff(staff_id)`                                  | gestora                   | `active=false` + revoga sessões (Edge Function)                                   |
| `complete_session(session_id, cuidados, retorno)`          | equipe                    | Transação: sessão, agenda, `ledger`, estoque, `care`, retorno, avisos, `activity` |
| `edit_finished_session` / `delete_finished_session`        | equipe (valores: gestora) | Corrige caixa, agenda e estoque juntos                                            |
| `report_payment(entry_id, method)`                         | cliente                   | Só preenche `reported` da própria cobrança                                        |
| `confirm_payment` / `reject_payment` / `reopen_receivable` | gestora                   | Mudam o estado financeiro e avisam a cliente                                      |
| `request_cancel` / `request_reschedule`                    | cliente                   | Só alteram esses campos do próprio horário                                        |
| `update_my_profile(...)`                                   | cliente                   | Só campos pessoais próprios                                                       |

Falhas esperadas (`credencial inválida`, `estoque insuficiente`) voltam como **resultado** (`{ok:false, motivo}`); só erros inesperados lançam exceção. Isso evita desfazer o registro de tentativas.

## 5. Índices previstos

| Consulta                 | Índice                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------- |
| Agenda do dia/semana     | `appointments (clinic_id, date, time)`                                             |
| Agenda da cliente        | `appointments (clinic_id, client_id, date desc)`                                   |
| Caixa por período e tipo | `ledger (clinic_id, kind, date desc)`                                              |
| A receber por vencimento | `ledger (clinic_id, kind, due)`                                                    |
| Histórico de eventos     | `activity (clinic_id, at desc)`                                                    |
| Avisos                   | `notifications (recipient_id, created_at desc)` e único `(recipient_id, rule_key)` |
| Rascunhos                | `sessions (clinic_id, status, started_at desc)`                                    |
| Perfil logado            | `profiles (id)` (pk)                                                               |

## 6. Tempo real

`Realtime` do Supabase respeita RLS: cada pessoa só recebe mudanças das linhas que pode ler. O `createStore` assina as tabelas que a tela usa e atualiza o cache; `useSyncExternalStore` continua igual. Habilitar Realtime só nas tabelas necessárias (agenda, avisos, ledger da gestora).

## 7. Plano de testes de RLS (pgTAP: `supabase test db`)

Usuários de teste: gestora X, funcionária X, gestora Y, cliente A (clínica X), cliente B (clínica X), anônimo (só chave `anon`).

| Teste                                                                       | Esperado               |
| --------------------------------------------------------------------------- | ---------------------- |
| Anônimo seleciona qualquer tabela                                           | 0 linhas / negado      |
| Cliente A lê ficha da B                                                     | 0 linhas               |
| Gestora X lê dados da clínica Y                                             | 0 linhas               |
| Qualquer usuário faz `update profiles set role='gestor'`                    | Negado                 |
| Cliente A insere horário `confirmed`                                        | Negado                 |
| Cliente A confirma o próprio pagamento (`update ledger set kind`)           | Negado                 |
| Funcionária seleciona `ledger`, `bills`, `stock_costs`, `session_finance`   | 0 linhas               |
| Funcionária seleciona `stock`, `appointments`, `clients` da própria clínica | Permitido              |
| Funcionária altera `procedures.price`                                       | Negado                 |
| Funcionária desativada acessa qualquer tabela                               | 0 linhas imediatamente |
| Credencial usada duas vezes, expirada, ou e-mail diferente                  | `{ok:false}`           |
| Equipe grava em `activity` direto                                           | Negado                 |
| Upload de arquivo não-imagem ou > 5 MB                                      | Negado                 |
| Cliente lê foto sem `image_consent`                                         | Negado                 |
| Tabela nova sem RLS                                                         | CI falha               |

## 8. Estado da implementação

Migrações em `supabase/migrations`, todas testadas com `bun run test` (91 verificações de banco no Postgres de teste + 10 do sincronizador do app):

| Arquivo                 | O que faz                                                                                                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `…01_schema.sql`        | Tabelas                                                                                                                                                                                                              |
| `…02_rls.sql`           | Funções auxiliares e políticas RLS                                                                                                                                                                                   |
| `…03_identity_rpcs.sql` | Criar clínica, credenciais, aceitar credencial, ações da cliente                                                                                                                                                     |
| `…04_permissions.sql`   | Permissões da equipe e `update_my_name`                                                                                                                                                                              |
| `…05_data_sync.sql`     | Colunas de apoio; `push_notification`, `log_activity`, `complete_session`, `edit_finished_session`, `delete_finished_session`, `confirm_my_appointment`, `busy_times`, `my_face_map`; tabela `face_maps`; tempo real |
| `…06_storage.sql`       | Bucket privado de fotos e suas políticas                                                                                                                                                                             |

No app, `src/lib/remote-store.ts` liga cada coleção à sua tabela (leitura, tempo real, gravação agrupada e na ordem certa) e `src/data/db.ts` define como cada registro vira linha e volta.

Push: função `supabase/functions/send-push` (Firebase Cloud Messaging) e `public/push-sw.js`; ligar em [PUSH-PASSO-A-PASSO.md](./PUSH-PASSO-A-PASSO.md).
