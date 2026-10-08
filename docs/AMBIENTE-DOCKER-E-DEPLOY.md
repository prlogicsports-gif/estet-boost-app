# Ambiente local (Docker), testes e publicação

Projeto. **Docker é só para desenvolvimento e testes**: sobe o Firebase Emulator Suite com dados de teste. Produção roda na Cloudflare (site) e no Firebase (dados e funções), sem container nosso.

## 1. Por que Docker aqui

- Testar login, regras, funções e avisos **sem tocar em dados reais e sem custo**.
- Todo mundo da equipe (e o CI) roda o mesmo ambiente.
- Os testes das regras de segurança rodam contra o emulador antes de qualquer publicação.

## 2. Estrutura prevista no repositório

```
firebase.json              emuladores, regras, índices, funções
.firebaserc                projetos: dev, staging, prod
firestore.rules            regras (ver FIRESTORE-MODELO-E-REGRAS.md)
firestore.indexes.json     índices
storage.rules              regras do Storage
functions/                 Cloud Functions (TypeScript)
  src/{createClinic,acceptInvite,completeSession,confirmPayment,reminders,...}.ts
emulator/
  Dockerfile               Node + Java + firebase-tools
  seed.ts                  dados de exemplo (o que hoje está em src/data/db.ts seed*)
docker-compose.yml
.env.example               só variáveis públicas e nomes de segredos (sem valores)
```

## 3. `docker-compose.yml` (rascunho)

```yaml
services:
  emulators:
    build: ./emulator
    command: firebase emulators:start --project estetboost-dev --import ./emulator/data --export-on-exit
    ports:
      - "4000:4000" # Emulator UI (ver e editar o banco de teste)
      - "9099:9099" # Auth
      - "8081:8081" # Firestore
      - "9199:9199" # Storage
      - "5001:5001" # Functions
    volumes:
      - ./:/workspace
    working_dir: /workspace
  app:
    image: oven/bun:1
    working_dir: /workspace
    command: sh -c "bun install && bun run dev -- --host 0.0.0.0 --port 8080"
    environment:
      VITE_FIREBASE_USE_EMULATOR: "true"
      VITE_FIREBASE_PROJECT_ID: estetboost-dev
    ports:
      - "8080:8080"
    volumes:
      - ./:/workspace
    depends_on: [emulators]
```

`emulator/Dockerfile`: imagem Node com Java (o Firestore Emulator exige) e `npm i -g firebase-tools`. Nada de credencial real dentro da imagem.

Para ver o banco de teste: **http://localhost:4000** (Emulator UI mostra usuários, documentos, arquivos e logs de funções).

## 4. Conexão do app ao emulador

Hoje não existe `firebase` no `package.json`. Na implementação: um módulo único `src/lib/firebase.ts` que inicializa o SDK com variáveis públicas e, se `VITE_FIREBASE_USE_EMULATOR=true`, aponta para `localhost`. Nenhum outro arquivo importa o SDK direto; só os serviços em `src/services/*`.

## 5. Testes

| O que                       | Como                                                                                               | Quando                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Regras do Firestore/Storage | `@firebase/rules-unit-testing` contra o emulador                                                   | A cada PR (tabela em FIRESTORE-MODELO-E-REGRAS.md §7) |
| Funções                     | Testes unitários + emulador                                                                        | A cada PR                                             |
| Fluxos de tela              | Playwright (scripts existentes em `scratchpad/e2e`, a mover para `e2e/`) apontando para o emulador | A cada PR                                             |
| Tipos e estilo              | `tsc --noEmit`, `eslint`                                                                           | A cada PR                                             |
| Dependências                | `bun audit`                                                                                        | A cada PR e semanal                                   |

## 6. Pipeline (GitHub Actions, rascunho)

1. `bun install --frozen-lockfile`
2. `tsc --noEmit` e `eslint`
3. `bun run build`
4. `firebase emulators:exec "bun run test:rules && bun run test:functions && bun run test:e2e"`
5. `bun audit` e varredura de segredos
6. Em `main` aprovado: publicar regras, índices e funções no **staging**; produção por aprovação manual.

O site é publicado pelo **Lovable/Cloudflare a cada push**. Para impedir que código sem teste vá ao ar, proteger o `main` (revisão e checks obrigatórios) e usar o preview do Cloudflare para validar.

## 7. Publicação

| Peça                         | Como                                  | Comando                                                                                      |
| ---------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------- |
| Site                         | Push no GitHub → Lovable → Cloudflare | automático                                                                                   |
| Regras e índices             | CI                                    | `firebase deploy --only firestore:rules,firestore:indexes,storage --project estetboost-prod` |
| Funções                      | CI                                    | `firebase deploy --only functions --project estetboost-prod`                                 |
| Segredos das funções         | uma vez, no terminal                  | `firebase functions:secrets:set NOME`                                                        |
| Segredos do site (se houver) | painel Cloudflare, por ambiente       | Settings → Variables and Secrets                                                             |

Ordem segura de uma mudança que altera dado e tela: publicar **funções e regras compatíveis com a versão antiga e a nova**, depois o site, depois remover o legado.

## 8. Cloudflare (site)

- Domínio próprio com HTTPS obrigatório e HSTS.
- **WAF e limite de requisições** em `/` (cadastro/login) e rotas de recuperação.
- Cabeçalhos de segurança definidos no SSR (`src/server.ts`) conforme [SEGURANCA-PRIVACIDADE.md](./SEGURANCA-PRIVACIDADE.md) §6.
- Variáveis `VITE_*` só com valores públicos; nada de segredo.

## 9. Passo a passo para quem vai configurar (resumo)

1. Criar a conta Google e três projetos no Firebase: `estetboost-dev`, `-staging`, `-prod` (região São Paulo).
2. No prod: ativar **Authentication** (e-mail/senha), **Firestore**, **Storage**, **Functions** (plano Blaze) e **App Check**.
3. Em Google Cloud: **alerta de orçamento** e **Audit Logs**.
4. Instalar Docker Desktop e rodar `docker compose up` para o ambiente local.
5. Só então começar a troca dos serviços (ver ordem em `docs/PROXIMA-ETAPA.md`).
