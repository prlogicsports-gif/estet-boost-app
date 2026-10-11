# EstetBoost.

**Cuidado organizado. Negócio em evolução.**

EstetBoost é um aplicativo para esteticistas autônomas e pequenas clínicas de estética. Ele reúne agenda, ficha das clientes, atendimentos, fotos de evolução, produtos, financeiro e um programa de fidelidade em um só lugar, no celular. A cliente tem o próprio acesso para ver horários, confirmar presença, acompanhar a evolução e juntar pontos.

Funciona como app instalável na tela inicial (PWA), em português do Brasil, inclusive sem internet: o que for feito offline é guardado e enviado quando a conexão volta.

## Quem usa

| Perfil          | O que faz                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| **Gestora**     | Controla tudo: agenda, clientes, financeiro, estoque, catálogo, equipe, fidelidade e campanhas.                 |
| **Funcionária** | Atende e registra, dentro das permissões que a gestora liberar (agenda, estoque, financeiro, histórico…).       |
| **Cliente**     | Vê e confirma horários, pede remarcação ou cancelamento, acompanha fotos e recomendações, ganha pontos e selos. |

## O que o app faz

- **Hoje e Agenda**: horários do dia e da semana, bloqueio de horários, confirmação de presença (pela cliente no app ou manual pela gestora), lembretes automáticos e mensagem de confirmação por WhatsApp.
- **Clientes**: ficha com anamnese editável, procedimentos, fotos com guia oval na câmera (para fotos simétricas em momentos diferentes), pacotes e retornos.
- **Atendimento**: passo a passo da sessão, mapas de ações no rosto, abdômen e glúteo, procedimento criado na hora, produtos usados com baixa automática no estoque.
- **Financeiro**: caixa, valores a receber e contas.
- **Produtos e estoque**: saldo, mínimo, validade e alertas.
- **Catálogo e Dashboard**: procedimentos da clínica e indicadores do negócio.
- **Acesso da cliente**: a gestora cria e-mail e senha no cadastro e envia o link do app pelo WhatsApp.
- **Fidelidade**: pontos por atendimento e presença, níveis, selos, ranking opcional com apelido, prêmios com resgate aprovado pela gestora e **campanhas** (sugestões prontas que a gestora edita) com envio automático dentro de limites que ela define.
- **Notificações**: avisos no app e push no celular, com central de notificações, banner e número no ícone.

## Como funciona por dentro

- **Interface**: React 19, TanStack Start/Router, Tailwind 4 e TypeScript. Identidade visual e tokens em `src/styles.css`.
- **Dados**: Supabase (Postgres com RLS em todas as tabelas, Auth, Storage, Realtime e pg_cron). Regras sensíveis ficam em funções do banco, não no aplicativo.
- **Offline**: o app guarda uma cópia local e uma fila de envio (`src/lib/remote-store.ts`).
- **Push**: Firebase Cloud Messaging por uma Edge Function (`supabase/functions/send-push`).
- **Privacidade**: a cliente só enxerga os próprios dados; o ranking mostra apenas apelido, posição e pontos.

## Estrutura

| Pasta                     | Conteúdo                                                     |
| ------------------------- | ------------------------------------------------------------ |
| `src/routes`              | Telas (gestora em `_gestor`, cliente em `cliente`)           |
| `src/components`          | Componentes por área (agenda, clientes, facemap, loyalty…)   |
| `src/services`            | Regras de cada área, acima do armazenamento                  |
| `src/lib`                 | Funções puras e utilitários                                  |
| `supabase/migrations`     | Banco, em ordem numerada (`bundle.sql` reúne tudo)           |
| `supabase/functions`      | Edge Functions                                               |
| `supabase/tests`, `tests` | Testes de banco (PGlite) e de código                         |
| `docs`                    | Guias: banco, push, acesso da cliente, fidelidade, segurança |

## Rodar localmente

```sh
bun install
bun run dev        # http://localhost:8080
bun run test       # banco + código
bun run build
```

Configuração do Supabase, push e publicação: veja [docs/SUPABASE-CONSOLE-GUIA.md](docs/SUPABASE-CONSOLE-GUIA.md), [docs/PUSH-PASSO-A-PASSO.md](docs/PUSH-PASSO-A-PASSO.md) e [docs/FIDELIDADE-E-CAMPANHAS.md](docs/FIDELIDADE-E-CAMPANHAS.md). A integração contínua (`.github/workflows/ci.yml`) roda tipos, testes e build a cada envio.

## Lovable

Projeto conectado ao [Lovable](https://lovable.dev/projects/1ad3066a-aa22-4447-a7a2-10cc22b3e892): mudanças feitas lá chegam aqui e o que é enviado para `main` aparece no editor. Evite reescrever o histórico já publicado.
