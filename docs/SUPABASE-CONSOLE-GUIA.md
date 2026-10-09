# Guia do painel Supabase (e do Firebase só para push)

Projeto. Serve para quem vai administrar o EstetBoost depois que o banco estiver ligado. Painel: **supabase.com/dashboard**. Push: **console.firebase.google.com** (só Cloud Messaging).

> Os dados de clientes (saúde e fotos) são sensíveis. Quem entra no painel consegue ler tudo (o painel usa privilégio de administrador). Dê acesso só a quem precisa, ligue verificação em duas etapas e revise quem tem acesso todo mês.

## 1. Onde fica cada coisa

| Quero…                                         | Onde no painel Supabase                              | Observação                                                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Ver e editar clientes, agenda, caixa, estoque  | **Table Editor**                                     | Tabelas `clients`, `appointments`, `ledger`, `stock`… Editar à mão só em emergência: não passa pelo RLS nem gera auditoria do app |
| Consultas e relatórios                         | **SQL Editor**                                       | Pode salvar consultas; vira base de relatórios                                                                                    |
| Ver quem tem conta, desativar, redefinir senha | **Authentication → Users**                           | Para desativar de verdade, marque também `profiles.active = false` (a função `disable_staff` faz isso)                            |
| Políticas de segurança                         | **Authentication → Policies** (ou Database → Tables) | **RLS deve estar ligado em todas as tabelas.** Mudanças só por migração                                                           |
| Ver fotos                                      | **Storage → photos**                                 | Caminho `{clinic_id}/{client_id}/`                                                                                                |
| Erros e execuções de funções                   | **Edge Functions → Logs**                            | `send_push`, lembretes                                                                                                            |
| Logs de API, Auth e banco                      | **Logs** (e Reports)                                 | Para investigar acesso indevido                                                                                                   |
| Lembretes agendados                            | **Integrations → Cron** (pg_cron)                    | Job de 5 em 5 min                                                                                                                 |
| Backups                                        | **Database → Backups**                               | Diários no Pro; **PITR** é adicional                                                                                              |
| Uso e custo                                    | **Settings → Billing / Usage**                       | Configurar alerta de gasto                                                                                                        |
| Segurança do projeto                           | **Advisors → Security**                              | Aponta tabela sem RLS e outros riscos; rodar a cada mudança                                                                       |
| Chaves                                         | **Settings → API**                                   | `anon` é pública; **`service_role` nunca sai daqui**                                                                              |

## 2. Ver e organizar o banco no dia a dia

- **Navegar**: Table Editor → escolha a tabela; filtre por `clinic_id`.
- **Relatórios**: SQL Editor (por exemplo, caixa do mês: `select sum(value) from ledger where kind='entradas' and date >= date_trunc('month', now())`). Para painéis visuais, conectar o Looker Studio ou Metabase a um **usuário de leitura** do banco (nunca ao `postgres`).
- **Mudar o banco**: sempre por **migração** no repositório (`supabase/migrations`), testada no Docker local e publicada pelo pipeline. Não altere tabelas pelo painel em produção.
- **Dados de teste**: use o **Studio local** (`http://127.0.0.1:54323`); nunca teste em produção.

## 3. Quem acessa o painel

Em **Organization → Team**, dê o menor papel possível:

| Pessoa             | Papel sugerido                                                          |
| ------------------ | ----------------------------------------------------------------------- |
| Dono(a) do projeto | Owner (1 ou 2 pessoas, com MFA obrigatório)                             |
| Desenvolvedor      | Developer no staging; no prod, acesso restrito e temporário             |
| Suporte            | Sem acesso ao projeto de produção (usar a ferramenta de suporte do app) |

## 4. Criar os projetos (primeira vez)

1. supabase.com → **New project** → nome `estetboost-staging` (repetir para `estetboost-prod`), **região São Paulo**, senha forte do banco (guardar em gerenciador de senhas).
2. **Authentication**: exigir **confirmação de e-mail**; ligar **CAPTCHA (Turnstile)**; configurar **SMTP próprio**; ajustar limites de e-mail e login; política de senha.
3. **Storage**: criar o bucket **`photos` privado** (limite de 5 MB; tipos `image/jpeg`, `image/png`, `image/webp`).
4. **Database → Extensions**: ativar `pg_cron` (e `pgcrypto`, se pedido).
5. **Settings → API**: copiar **URL** e chave **`anon`** (públicas) para `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
6. Prod: ativar o plano **Pro**, ligar **PITR** e configurar alerta de gasto.

**Não copie para o app**: `service_role`, senha do banco, JWT secret. Isso só existe nas secrets das funções.

## 5. Firebase só para push (FCM)

1. console.firebase.google.com → **Adicionar projeto** `estetboost-push` (sem Analytics).
2. **Project settings → Cloud Messaging**: usar a API **HTTP v1** (a antiga está descontinuada).
3. **Project settings → Service accounts → Generate new private key**: baixa um arquivo JSON. **Esse arquivo é um segredo**: guardar como secret da função `send_push` (`supabase secrets set`), nunca no repositório, no chat ou no navegador.
4. **Seus apps → Web**: copiar a config web (pública) para as variáveis `VITE_FIREBASE_*` e gerar a chave VAPID (pública) para o push web.
5. O app registra o token do aparelho em `push_tokens`; a Edge Function `send_push` envia pelo FCM.

Push web exige o _service worker_ e a instalação na tela inicial (etapa PWA, depois).

## 6. Rotina de manutenção

| Quando                           | O que                                                                       |
| -------------------------------- | --------------------------------------------------------------------------- |
| Diário                           | Olhar erros em Edge Functions e Logs                                        |
| Semanal                          | Conferir uso/custo, **Advisors → Security** e `bun audit`                   |
| Mensal                           | Revisar quem tem acesso ao painel e ao Firebase; revisar contas desativadas |
| Trimestral                       | Testar restauração de backup; rodar o roteiro de teste de invasão           |
| Sempre que sair alguém da equipe | Remover do Supabase, Firebase, Cloudflare e GitHub no mesmo dia             |

## 7. Incidente (suspeita de acesso indevido)

1. **Contenção**: desativar usuários suspeitos; se necessário, revogar sessões e **rotacionar as chaves** (Settings → API; JWT secret) e as secrets das funções.
2. **Investigação**: Logs (API, Auth, Postgres) e a tabela `activity`.
3. **Rotação**: senha do banco, `service_role`, conta de serviço do FCM, `pepper` das credenciais.
4. **Comunicação**: avisar clientes afetados e a ANPD no prazo da LGPD; registrar tudo.
