# Notificações com Firebase: especificação para o Lovable

O app já funciona de ponta a ponta **sem banco**: cadastro de clientes, agendamentos, pedidos da cliente, caixa, contas, estoque e notificações. Tudo vive no aparelho (`localStorage`) e foi escrito para trocar o armazenamento sem mexer nas telas. Este documento diz o que o Firebase precisa fazer no lugar.

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

## 2. Modelo no Firestore

Fuso de todas as regras: **America/Sao_Paulo**. Datas como `AAAA-MM-DD`; instantes em ISO UTC.

```
users/{uid}
  role: "gestor" | "cliente"
  clientId?: string            // só para cliente: id em clients
  fcmTokens: string[]          // um por aparelho/navegador
  prefs: { appointments, payments, stock, recommendations, push, whatsapp: boolean }

clients/{clientId}             // ClientRec em src/data/db.ts
appointments/{id}              // AppointmentRec em src/lib/models.ts
notifications/{ruleKey|autoId} // NotificationRec; o id do documento É a ruleKey nas automáticas
bills/{id}                     // BillRec
ledger/{id}                    // LedgerEntry (entradas, saidas, receber)
stock/{nome}                   // StockEntry
care/{id}                      // CareRec (recomendações, com horário de lembrete)
```

`notifications` precisa de `audience` ("gestor" | "cliente"), `clientId?`, `read`, `createdAt`, `kind`, `title`, `body`, `href?`, ordenado por `createdAt` desc.

Para evitar notificação duplicada, grave o documento com **id = ruleKey** usando `create()` (falha se já existir).

## 3. Quando avisar (as regras)

O texto, o destino e o `ruleKey` de **cada** aviso estão num catálogo único: `src/services/notification-events.ts` (objeto `events`). As regras agendadas estão em `src/services/reminders.ts`. As Cloud Functions devem reproduzir os dois:

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

1. Ao entrar, o app pede permissão (`registerPush` em `push.service.ts`), obtém o token com `getToken()` e grava em `users/{uid}.fcmTokens` (`arrayUnion`).
2. Adicione `public/firebase-messaging-sw.js` para receber push com o app fechado; o clique abre `href`.
3. A função que cria a notificação envia o push para os `fcmTokens` do destinatário (`sendEachForMulticast`) e remove tokens inválidos.
4. Destinatário = `audience: "gestor"` → o usuário gestor; `audience: "cliente"` → o usuário com `clientId` igual.

## 5. Regras de segurança (resumo)

- `gestor`: lê e escreve tudo da própria clínica.
- `cliente`: lê **só** seus `appointments`, `care`, `notifications` (com seu `clientId`) e o próprio `clients/{clientId}`; escreve apenas solicitações (`appointments` com `origin: "cliente"`) e preferências.
- Observações internas das marcações do mapa facial **não** vão para a cliente (hoje o app as remove antes de exibir).

## 6. Como migrar sem mexer nas telas

1. Reimplemente `createStore` em `src/lib/db.ts` com Firestore, mantendo `get`, `set`, `reset` e `use` (use `onSnapshot` para o `use`).
2. Mantenha `src/services/*` como estão: eles só chamam `store.set(...)` e `notify(...)`.
3. Troque o corpo de `notify()` por escrita em `notifications` (com `ruleKey` como id).
4. Mova `runReminders()` para uma Cloud Function agendada e **remova o `setInterval`** em `src/components/shell/app-shell.tsx`.
5. Troque `authService` (`src/services/auth.service.ts`) por Firebase Auth. O perfil (`gestor`/`cliente`) e o `clientId` vêm de `users/{uid}`; `RoleGate` e as rotas protegidas já usam isso.

Para testar localmente a qualquer momento: Configurações → "Restaurar dados de exemplo".
