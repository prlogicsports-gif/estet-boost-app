# Ambiente local (Docker), testes e publicação

Projeto. **Docker é só para desenvolvimento e testes**: o Supabase CLI sobe a pilha completa do Supabase em containers no seu computador, com dados de teste. Produção roda na Cloudflare (site) e no Supabase na nuvem (dados), sem container nosso.

## 1. Por que Docker aqui

- Testar login, RLS, funções, e-mails e avisos **sem tocar em dados reais e sem custo**.
- Todo mundo da equipe (e o CI) roda o mesmo ambiente.
- Os testes de segurança (RLS) rodam contra esse banco antes de qualquer publicação.

## 2. Estrutura prevista no repositório

```
supabase/
  config.toml              configuração local (portas, Auth, Storage)
  migrations/              esquema, funções, RLS, índices (versionados, revisados como código)
  seed.sql                 dados de exemplo (hoje em src/data/db.ts seed*)
  functions/               Edge Functions (TypeScript/Deno): send_push, export_client_data, reminders...
  tests/                   testes pgTAP das políticas RLS
src/lib/supabase.ts        único arquivo que cria o cliente supabase-js
.env.example               só variáveis públicas e nomes de segredos (sem valores)
.github/workflows/         CI
```

## 3. Subir o ambiente local

Pré-requisito: **Docker Desktop**. Depois:

```
supabase start        # sobe Postgres, Auth, Storage, Realtime, Studio, e-mail de teste
supabase db reset     # aplica as migrações e o seed.sql
supabase functions serve   # Edge Functions locais
bun run dev           # o app, apontando para o Supabase local
```

Endereços locais padrão (do Supabase CLI):

| Serviço                                             | Endereço                 |
| --------------------------------------------------- | ------------------------ |
| API (URL e chaves locais, só de teste)              | `http://127.0.0.1:54321` |
| **Studio** (ver e editar o banco de teste)          | `http://127.0.0.1:54323` |
| Caixa de e-mail de teste (confirmação, recuperação) | `http://127.0.0.1:54324` |
| Postgres                                            | `127.0.0.1:54322`        |

`supabase status` mostra a URL e as chaves **locais** (descartáveis). Elas não valem em nenhum outro ambiente.

## 4. Conexão do app

Hoje não existe `@supabase/supabase-js` no `package.json`. Na implementação: um módulo único `src/lib/supabase.ts` cria o cliente com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (públicas). Nenhum outro arquivo importa o SDK direto; só os serviços em `src/services/*`. Tipos do banco gerados com `supabase gen types typescript`.

## 5. Testes

| O que                | Como                                                                                                     | Quando              |
| -------------------- | -------------------------------------------------------------------------------------------------------- | ------------------- |
| Políticas RLS e RPCs | pgTAP: `supabase test db` (tabela em SUPABASE-MODELO-E-RLS.md §7)                                        | A cada PR           |
| Tabela sem RLS       | `supabase db lint` + teste que lista tabelas sem RLS                                                     | A cada PR           |
| Edge Functions       | Testes Deno + `supabase functions serve`                                                                 | A cada PR           |
| Fluxos de tela       | Playwright (scripts existentes em `scratchpad/e2e`, a mover para `e2e/`) apontando para o Supabase local | A cada PR           |
| Tipos e estilo       | `tsc --noEmit`, `eslint`                                                                                 | A cada PR           |
| Dependências         | `bun audit`                                                                                              | A cada PR e semanal |

## 6. Pipeline (GitHub Actions, rascunho)

1. `bun install --frozen-lockfile`
2. `tsc --noEmit` e `eslint`
3. `bun run build`
4. `supabase start` no runner → `supabase db reset` → `supabase test db` → testes de fluxo
5. `bun audit` e varredura de segredos
6. Em `main` aprovado: `supabase db push` para o **staging**; produção por aprovação manual.

O site é publicado pelo **Lovable/Cloudflare a cada push**. Para impedir que código sem teste vá ao ar, proteger o `main` (revisão e checks obrigatórios) e usar o preview do Cloudflare.

> Cuidado com o Lovable: se a integração do Lovable gerar ou alterar migrações sozinha, elas entram no repositório. Revisar todo arquivo em `supabase/migrations` antes de publicar e nunca alterar a produção pelo painel.

## 7. Publicação

| Peça                                | Como                                  | Comando                                                         |
| ----------------------------------- | ------------------------------------- | --------------------------------------------------------------- |
| Site                                | Push no GitHub → Lovable → Cloudflare | automático                                                      |
| Banco (migrações, RLS, funções SQL) | CI                                    | `supabase db push --linked` (staging, depois prod)              |
| Edge Functions                      | CI                                    | `supabase functions deploy`                                     |
| Segredos das funções                | uma vez, no terminal                  | `supabase secrets set NOME=valor` (nunca em arquivo versionado) |
| Segredos do site (se houver)        | painel Cloudflare, por ambiente       | Settings → Variables and Secrets                                |

Ordem segura de uma mudança que altera dado e tela: publicar migração **compatível com a versão antiga e a nova**, depois o site, depois remover o legado.

## 8. Cloudflare (site)

- Domínio próprio com HTTPS obrigatório e HSTS.
- **WAF e limite de requisições** em `/` (cadastro/login) e rotas de recuperação; Turnstile nos formulários de acesso.
- Cabeçalhos de segurança no SSR (`src/server.ts`) conforme [SEGURANCA-PRIVACIDADE.md](./SEGURANCA-PRIVACIDADE.md) §6.
- Variáveis `VITE_*` só com valores públicos; **nunca** `service_role`.

## 9. Passo a passo para quem vai configurar (resumo)

1. Criar a conta Supabase (organização sua) e dois projetos, **`estetboost-staging`** e **`estetboost-prod`**, região **São Paulo**; ativar o plano Pro no prod.
2. No prod: Auth → exigir confirmação de e-mail, ligar Turnstile, configurar SMTP próprio e limites; Storage → criar o bucket **privado** `photos`.
3. Criar o projeto Firebase **só para push** (Cloud Messaging) e gerar a chave de conta de serviço; guardá-la como secret da função `send_push` (nunca no chat ou no código).
4. Instalar o Docker Desktop e o Supabase CLI; rodar `supabase start`.
5. Só então começar a troca dos serviços (ordem em [PROXIMA-ETAPA.md](./PROXIMA-ETAPA.md)).

## 10. Alternativa sem Docker (decisão atual do projeto)

O projeto **não usa Docker** por enquanto. No lugar:

- **Testes do banco**: `bun run test:db` roda um **Postgres real dentro do Node (PGlite)**, aplica todas as migrações de `supabase/migrations` e executa os testes de segurança (`supabase/tests/rls.test.mjs`): isolamento entre clínicas, funcionária sem financeiro, credenciais, RLS em todas as tabelas. Não precisa de Docker nem de internet.
- **Aplicar no Supabase (staging)**: `bun run db:bundle` junta as migrações em `supabase/bundle.sql`; cole o conteúdo em **Supabase → SQL Editor → Run**. Em mudanças futuras, aplique **só as migrações novas**, na ordem.
- **Cuidado com o Lovable**: com o Supabase conectado ao Lovable, ele pode sugerir ou aplicar SQL por conta própria. Recuse alterações de esquema que não venham de `supabase/migrations`.
- Sem ambiente local, **todo teste de tela acontece no projeto de staging** (dados fictícios). O projeto de produção só recebe migrações depois de passarem no `test:db` e no staging.
