# Notificações: avisos no Supabase e push pelo Firebase (FCM)

> **Decisão atual:** os avisos e os dados vivem no **Supabase** (tabela `notifications`, Realtime, `pg_cron`, Edge Function `send_push`). O **Firebase é usado só para o Cloud Messaging** (entrega do push). Onde este texto fala em Firestore ou Cloud Functions, leia: tabelas do Postgres e funções do Supabase. Veja [Arquitetura](./ARQUITETURA.md) e [Modelo do banco](./SUPABASE-MODELO-E-RLS.md).

O app já funciona de ponta a ponta **sem banco**: cadastro de clientes, agendamentos, pedidos da cliente, caixa, contas, estoque e notificações. Tudo vive no aparelho (`localStorage`) e foi escrito para trocar o armazenamento sem mexer nas telas. Este documento diz o que o backend precisa fazer no lugar.

## 1. O que já existe e onde

| Peça                   | Arquivo                                     | Papel                                                                                                      |
| ---------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Banco local reativo    | `src/lib/db.ts`                             | `createStore(chave, semente)` com `get`, `set`, `use`. **É o único arquivo que fala com o armazenamento.** |
| Coleções               | `src/data/db.ts`                            | `clientsDb`, `appointmentsDb`, `notificationsDb`, `billsDb`, `ledgerDb`, `stockDb`, `careDb`, `prefsDb`    |
| Modelos                | `src/lib/models.ts`                         | Tipos de atendimento, notificação, conta, cuidado e preferências                                           |
| Serviços (ações)       | `src/services/*.service.ts`                 | Criar, aprovar, recusar, cancelar, remarcar, concluir atendimento, pagar conta                             |
| Gerador de avisos      | `src/services/notify.ts`                    | `notify()` cria a notificação; `ruleKey` impede duplicar                                                   |
| **Regras de lembrete** | `src/services/reminders.ts`                 | As regras abaixo, rodando a cada 60 s com o app aberto                                                     |
| Push no navegador      | `src/services/push.service.ts`              | Permissão e exibição local; vira registro de token FCM                                                     |
| Central de avisos      | `src/components/eb/notifications-panel.tsx` | Lista, filtro, leitura e preferências                                                                      |

## 2. Modelo no Supabase

Fuso de todas as regras: **America/Sao_Paulo**. Datas como `date`; instantes em `timestamptz`.

- `profiles` (papel e clínica), `clients`, `appointments`, `ledger`, `bills`, `stock`, `care`, `prefs`: ver [SUPABASE-MODELO-E-RLS.md](./SUPABASE-MODELO-E-RLS.md).
- `push_tokens (user_id, token, platform)`: um por aparelho/navegador.
- `notifications (id, clinic_id, recipient_id, rule_key, kind, title, body, href, read, created_at)` com `unique (recipient_id, rule_key)`: **um registro por destinatário** (a gestora, cada funcionária e a cliente). O aviso "para a equipe" gera uma linha para cada pessoa da equipe.

Para evitar notificação duplicada, insira com `on conflict (recipient_id, rule_key) do nothing`.

## 3. Quando avisar (as regras)

O texto, o destino e o `ruleKey` de **cada** aviso estão num catálogo único: `src/services/notification-events.ts` (objeto `events`). As regras agendadas estão em `src/services/reminders.ts`. As funções do Supabase (SQL e Edge Functions) devem reproduzir os dois:

### Eventos (disparam na hora, por gatilho de escrita)

| Evento                                          | Para    | Título                                   | Leva a                |
| ----------------------------------------------- | ------- | ---------------------------------------- | --------------------- |
| Esteticista agenda e marca "enviar confirmação" | cliente | Novo horário agendado                    | `/cliente/agenda`     |
| Cliente solicita horário                        | gestor  | Nova solicitação de horário              | `/agenda`             |
| Gestor aprova a solicitação                     | cliente | Horário confirmado                       | `/cliente/agenda`     |
| Gestor recusa                                   | cliente | Horário não disponível                   | `/cliente/agenda`     |
| Cliente confirma presença                       | gestor  | "{nome} confirmou presença"              | `/atendimentos/{id}`  |
| Cliente pede remarcação                         | gestor  | Pedido de remarcação                     | `/atendimentos/{id}`  |
| Cliente cancela (menos de 24 h)                 | gestor  | Pedido de cancelamento                   | `/atendimentos/{id}`  |
| Gestor remarca ou cancela                       | cliente | Horário alterado / Atendimento cancelado | `/cliente/agenda`     |
| Atendimento concluído com cuidados              | cliente | Novos cuidados de Fernanda               | `/cliente/evolucao`   |
| Retorno agendado ao fechar o atendimento        | cliente | Retorno sugerido                         | `/cliente/agenda`     |
| Nova cliente se cadastra                        | gestor  | Nova cliente na carteira                 | `/clientes/{id}`      |
| Estoque cai até o mínimo                        | gestor  | Estoque baixo                            | `/gestao?aba=estoque` |
| **Cliente informa que pagou**                   | gestor  | "{nome} informou um pagamento"           | `/gestao?aba=receber` |
| Gestor confirma o recebimento                   | cliente | Pagamento confirmado                     | `/cliente`            |
| Gestor não localizou o pagamento                | cliente | Não localizamos o pagamento              | `/cliente`            |
| Cliente se filia pelo link/credencial           | cliente | Você agora faz parte de {clínica}        | `/cliente`            |
| Atendimento fechado: produtos > 35% do valor    | gestor  | Produtos pesaram no atendimento          | `/gestao`             |

### Agendadas (função com cron a cada 5 minutos)

| Regra                            | Para                 | Quando                                                                    | ruleKey                                |
| -------------------------------- | -------------------- | ------------------------------------------------------------------------- | -------------------------------------- |
| Atendimento amanhã               | cliente              | véspera                                                                   | `r24:{apptId}`                         |
| Atendimento hoje                 | cliente              | no dia                                                                    | `r0:{apptId}`                          |
| Sem confirmação                  | gestor               | no dia, enquanto `status = pending`                                       | `unconf:{apptId}:{dia}`                |
| Próximo atendimento              | gestor               | 60 min antes                                                              | `soon:{apptId}`                        |
| **Conta a pagar**                | gestor               | **todo dia, de 3 dias antes até o dia do vencimento**                     | `bill:{id}:{dia}`                      |
| Conta atrasada                   | gestor               | todo dia após o vencimento                                                | `bill-late:{id}:{dia}`                 |
| **Cobrança a receber**           | gestor **e** cliente | **todo dia, de 3 dias antes até o vencimento**                            | `recv:{id}:{dia}` / `crecv:{id}:{dia}` |
| **Produto/cuidado indicado**     | cliente              | **no horário `reminderTime` de cada recomendação, todo dia, até `until`** | `care:{id}:{dia}`                      |
| Cliente no período de retorno    | gestor               | uma vez por cliente parada                                                | `cold:{clientId}`                      |
| **Produto vence em até 30 dias** | gestor               | todo dia (uma por data de validade)                                       | `expiring:{stockId}:{validade}`        |
| Produto vencido                  | gestor               | uma vez por validade                                                      | `expired:{stockId}:{validade}`         |

Textos de vencimento: "vence hoje", "vence amanhã", "vence em N dias" (ver `dueText`).

Respeite as preferências: `appointments`, `payments`, `stock`, `recommendations`. Se `push = false`, grave a notificação (aparece no app) mas **não envie push**.

## 4. Entrega (FCM)

1. Ao entrar, o app pede permissão (`registerPush` em `push.service.ts`), obtém o token do FCM com `getToken()` e grava em `push_tokens` (RLS: cada pessoa só grava e lê os próprios).
2. Adicione `public/firebase-messaging-sw.js` para receber push com o app fechado; o clique abre `href`. (Depende da instalação na tela inicial, etapa PWA.)
3. Ao inserir uma linha em `notifications`, um gatilho do banco chama a **Edge Function `send_push`**, que lê os `push_tokens` do destinatário e envia pela API **HTTP v1** do FCM, removendo tokens inválidos.
4. A conta de serviço do Firebase é **secret** da função (`supabase secrets set`), nunca no navegador nem no repositório.
5. Respeita `prefs.push`: com `push = false`, a linha entra em `notifications` (aparece no app) mas **não há envio de push**.
6. Destinatário: `audience gestor` → a gestora; `equipe` → gestora e funcionárias (avisos de atendimento, estoque e clientes, **nunca** financeiros para a funcionária); `cliente` → a conta da cliente.

## 5. Segurança

- RLS: cada pessoa lê só `notifications` com `recipient_id = auth.uid()` e só marca `read`.
- Cliente nunca recebe observações internas do mapa facial (hoje o app as remove antes de exibir).
- Avisos financeiros (`payment`, `bill`, margem) só vão para a gestora.

## 6. Como migrar sem mexer nas telas

1. Reimplemente `createStore` em `src/lib/db.ts` com `supabase-js` (consulta inicial + Realtime), mantendo `get`, `set`, `reset` e `use`.
2. Mantenha `src/services/*` como estão: eles só chamam `store.set(...)` e `notify(...)`.
3. Troque o corpo de `notify()` por inserção em `notifications` (com `rule_key`).
4. Mova `runReminders()` para uma função agendada por **pg_cron** (a cada 5 min) e **remova o `setInterval`** em `src/components/shell/app-shell.tsx`.
5. Troque `authService` (`src/services/auth.service.ts`) por Supabase Auth. O papel e a clínica vêm de `profiles`; `RoleGate` e as rotas protegidas já usam isso.

Para testar localmente a qualquer momento: Configurações → "Restaurar dados de exemplo" (só no estado de teste atual).
