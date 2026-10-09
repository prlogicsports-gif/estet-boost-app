# Modelo do Firestore e regras de segurança

> **Equipe:** regras ganham `isPro(c)` (gestora ou funcionária) e o financeiro vai para caminhos só da gestora. Ver [Equipe e permissões](./EQUIPE-E-PERMISSOES.md) §4.
> Projeto. Mapeia os stores locais de `src/data/db.ts` e os tipos de `src/lib/models.ts` para Firestore. Valores de dinheiro em **centavos inteiros** no banco (hoje são `number` em reais; converter na camada de serviço). Datas como `Timestamp` ou ISO `YYYY-MM-DD` quando for só o dia.

## 1. Árvore de coleções

```
users/{uid}                          perfil mínimo e vínculo (escrito só por função)
  prefs/{doc}                        preferências de notificação
  fcmTokens/{token}                  aparelhos para push

clinics/{clinicId}                   ClinicRec (nome, slug, contato, dono)
  clients/{clientId}                 ClientRec
    anamnesis/{doc}                  AnamnesisRec (sensível)
    photos/{photoId}                 metadados da foto (arquivo no Storage)
    care/{careId}                    CareRec (recomendações)
  appointments/{id}                  AppointmentRec
  sessions/{id}                      SessionRec (rascunho e finalizado)
  ledger/{id}                        LedgerEntry (caixa e a receber)
  bills/{id}                         BillRec
  stock/{id}                         StockRec
  procedures/{id}                    ProcedureRec
  blocks/{id}                        BlockRec
  config/hours                       HoursRec
  config/settings                    Settings (perguntas da anamnese, termo)
  notifications/{id}                 NotificationRec (campo audience e clientId)
  activity/{id}                      ActivityRec (auditoria, append-only)

invites/{codeHash}                   credenciais (só hash), com clinicId, validade, uso
slugs/{slug}                         slug público -> clinicId (para o link de cadastro)
```

Por que subcoleções por clínica: a regra de isolamento fica simples (`clinicId` do caminho = `clinicId` do token) e uma consulta nunca atravessa clínicas.

## 2. Documentos principais

**`users/{uid}`** (escrito só por função)

```
{ role: "gestor" | "cliente", clinicId, clientId?: string,
  name, email, createdAt, termsAcceptedAt, termsVersion }
```

**`clinics/{clinicId}/clients/{clientId}`** (de `ClientRec`)

```
{ name, initials, phone, email?, birth?, document?, address?, goal?, allergies?,
  contra?, note?, mainProcedure, imageConsent: boolean, imageConsentAt?,
  uid?: string  // preenchido quando a cliente cria acesso
  createdAt, updatedAt }
```

`lastVisit`, `nextReturn`, `age`, `status` hoje são texto calculado; no banco viram **campos derivados** (`lastVisitAt`, `nextReturnAt`) e a tela formata.

**`ledger/{id}`** (de `LedgerEntry`)

```
{ kind: "entradas" | "saidas" | "receber", dateISO, dueISO?, label, origin, method,
  valueCents, clientId?, refId?, reported?: { at, method }, createdBy, updatedAt }
```

**`invites/{codeHash}`**

```
{ clinicId, createdBy, nameHint?, phoneHint?, expiresAt, usedAt?, usedBy?, revoked?: boolean, attempts: number }
```

O código `EB-XXXX-XXXX` nunca é gravado; `codeHash = SHA-256(pepper + código)`, com `pepper` em Secret Manager.

Demais coleções seguem os tipos em `src/lib/models.ts` com `createdAt`/`updatedAt` e `createdBy` (uid).

## 3. Índices previstos

| Consulta                           | Índice                                                    |
| ---------------------------------- | --------------------------------------------------------- |
| Agenda do dia/semana               | `appointments`: `date` asc, `time` asc                    |
| Agenda da cliente                  | `appointments`: `clientId`, `date` desc                   |
| Caixa por período e tipo           | `ledger`: `kind`, `dateISO` desc                          |
| A receber em aberto por vencimento | `ledger`: `kind`, `dueISO` asc                            |
| Histórico de eventos               | `activity`: `at` desc (e `kind`, `at`)                    |
| Notificações por papel             | `notifications`: `audience`, `clientId`, `createdAt` desc |
| Rascunhos de atendimento           | `sessions`: `status`, `startedAt` desc                    |

Criados em `firestore.indexes.json` e publicados pelo pipeline.

## 4. Quem escreve o quê

| Coleção                                         | Navegador (gestora) | Navegador (cliente)                               | Só função                                        |
| ----------------------------------------------- | ------------------- | ------------------------------------------------- | ------------------------------------------------ |
| `users`, `invites`, `slugs`, `activity`, claims | Não                 | Não                                               | Sim                                              |
| `clinics/*` (dados cadastrais)                  | U                   | Não                                               | C (createClinic)                                 |
| `clients`                                       | C U D               | U campos pessoais próprios                        | filiação por link                                |
| `appointments`                                  | C U D               | C (pedido `pending`), U (pedir cancelar/remarcar) | aprovações com efeito colateral podem ser função |
| `sessions`                                      | C U D (rascunho)    | Não                                               | Fechar (`completeSession`)                       |
| `ledger`, `bills`, `stock`                      | C U D               | R próprio; U só `reported`                        | confirmar/recusar, baixa de estoque na transação |
| `photos` (metadado)                             | C D                 | Não                                               | URL assinada, EXIF                               |
| `notifications`                                 | U `read`            | U `read`                                          | C                                                |

## 5. Rascunho das Security Rules (Firestore)

> Rascunho de projeto. Será ajustado e coberto por testes no emulador antes de ir a produção. Regra de ouro: **tudo negado por padrão**.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {

    // ---- funções auxiliares ----
    function signedIn()      { return request.auth != null; }
    function role()          { return request.auth.token.role; }
    function inClinic(c)     { return signedIn() && request.auth.token.clinicId == c; }
    function isGestor(c)     { return inClinic(c) && role() == 'gestor'; }
    function isOwnClient(c, id) {
      return inClinic(c) && role() == 'cliente' && request.auth.token.clientId == id;
    }
    function untouched(fields) {
      return !request.resource.data.diff(resource.data).affectedKeys().hasAny(fields);
    }

    // ---- negar tudo por padrão ----
    match /{document=**} { allow read, write: if false; }

    // ---- identidade: só leitura do próprio; escrita só por função ----
    match /users/{uid} {
      allow read: if signedIn() && request.auth.uid == uid;
      allow write: if false;
      match /prefs/{d} { allow read, write: if signedIn() && request.auth.uid == uid; }
      match /fcmTokens/{t} { allow read, write: if signedIn() && request.auth.uid == uid; }
    }

    match /invites/{h} { allow read, write: if false; }   // só funções
    match /slugs/{s}   { allow read: if true; allow write: if false; } // só nome público

    match /clinics/{c} {
      allow read: if inClinic(c);
      allow update: if isGestor(c) && untouched(['slug','owner','createdAt']);
      allow create, delete: if false;

      // ---- clientes ----
      match /clients/{id} {
        allow read: if isGestor(c) || isOwnClient(c, id);
        allow create, delete: if isGestor(c);
        allow update: if isGestor(c)
          || (isOwnClient(c, id) && request.resource.data.diff(resource.data)
              .affectedKeys().hasOnly(['name','phone','email','birth','address','goal','allergies','imageConsent','imageConsentAt','updatedAt']));

        match /anamnesis/{d} { allow read, write: if isGestor(c); allow read: if isOwnClient(c, id); }
        match /photos/{p}    { allow read, create, delete: if isGestor(c); } // cliente via URL assinada
        match /care/{d}      { allow read: if isGestor(c) || isOwnClient(c, id); allow write: if isGestor(c); }
      }

      // ---- agenda ----
      match /appointments/{id} {
        allow read: if isGestor(c) || (inClinic(c) && role() == 'cliente' && resource.data.clientId == request.auth.token.clientId);
        allow create: if isGestor(c)
          || (inClinic(c) && role() == 'cliente'
              && request.resource.data.clientId == request.auth.token.clientId
              && request.resource.data.status == 'pending' && request.resource.data.origin == 'cliente');
        allow update: if isGestor(c)
          || (inClinic(c) && role() == 'cliente' && resource.data.clientId == request.auth.token.clientId
              && request.resource.data.diff(resource.data).affectedKeys()
                 .hasOnly(['cancelRequest','reschedule','proposedDate','proposedTime']));
        allow delete: if isGestor(c);
      }

      // ---- dinheiro e estoque ----
      match /ledger/{id} {
        allow read: if isGestor(c) || (inClinic(c) && role() == 'cliente' && resource.data.clientId == request.auth.token.clientId);
        allow create, delete: if isGestor(c);
        allow update: if isGestor(c)
          || (inClinic(c) && role() == 'cliente' && resource.data.clientId == request.auth.token.clientId
              && resource.data.kind == 'receber'
              && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['reported','updatedAt']));
      }
      match /bills/{id}      { allow read, write: if isGestor(c); }
      match /stock/{id}      { allow read, write: if isGestor(c); }
      match /procedures/{id} { allow read: if inClinic(c); allow write: if isGestor(c); }
      match /blocks/{id}     { allow read: if inClinic(c); allow write: if isGestor(c); }
      match /config/{d}      { allow read: if inClinic(c); allow write: if isGestor(c); }
      match /sessions/{id} {
        allow read: if isGestor(c);
        allow create: if isGestor(c) && request.resource.data.status == 'draft';
        allow update, delete: if isGestor(c) && resource.data.status == 'draft'
                              && (request.method == 'delete' || request.resource.data.status == 'draft');
        // finalizar e corrigir atendimento finalizado: só por função
      }

      // ---- avisos e auditoria ----
      match /notifications/{id} {
        allow read: if isGestor(c) ? resource.data.audience == 'gestor'
                     : inClinic(c) && resource.data.audience == 'cliente' && resource.data.clientId == request.auth.token.clientId;
        allow update: if inClinic(c) && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read']);
        allow create, delete: if false;
      }
      match /activity/{id} { allow read: if isGestor(c); allow write: if false; }
    }
  }
}
```

Pontos a refinar nos testes: leitura de `sessions` finalizadas (gestora lê; edição só por função), validação de tipos e limites de tamanho em `create`, regra de `notifications` quando a gestora é a única, e bloqueio de listagem ampla (`list`) sem filtro por `clientId` para o papel cliente.

## 6. Security Rules do Storage

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{all=**} { allow read, write: if false; }
    match /clinics/{c}/clients/{id}/photos/{file} {
      allow create: if request.auth.token.clinicId == c && request.auth.token.role == 'gestor'
                    && request.resource.size < 5 * 1024 * 1024
                    && request.resource.contentType.matches('image/(jpeg|png|webp)');
      allow read, delete: if request.auth.token.clinicId == c && request.auth.token.role == 'gestor';
      // a cliente lê apenas por URL assinada gerada por função (signedPhotoUrl)
    }
  }
}
```

## 7. Plano de testes das regras (emulador)

Usar `@firebase/rules-unit-testing` com contas: gestora X, gestora Y, cliente A (clínica X), cliente B (clínica X), anônimo.

| Teste                                              | Esperado  |
| -------------------------------------------------- | --------- |
| Anônimo lê qualquer coisa (exceto `slugs`)         | Negado    |
| Cliente A lê ficha da B                            | Negado    |
| Gestora X lê clínica Y                             | Negado    |
| Usuário escreve em `users/{uid}`                   | Negado    |
| Cliente A cria pedido de horário `pending` próprio | Permitido |
| Cliente A cria horário `confirmed`                 | Negado    |
| Cliente A altera `reported` da própria cobrança    | Permitido |
| Cliente A altera `value` ou `kind` da cobrança     | Negado    |
| Cliente confirma o próprio pagamento (muda `kind`) | Negado    |
| Gestora grava em `activity`                        | Negado    |
| Upload no Storage de arquivo `.exe` ou > 5 MB      | Negado    |
| Leitura de foto sem ser gestora da clínica         | Negado    |

Os testes rodam no CI a cada alteração em `firestore.rules`/`storage.rules`; falhou, não publica.
