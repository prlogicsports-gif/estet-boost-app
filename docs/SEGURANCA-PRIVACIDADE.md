# Segurança e privacidade

Projeto de normas e checklist. **Ainda não implementado.** O estado atual do app é só para validar fluxos: não use com dados reais de clientes.

## 1. O que o "inspecionar" mostra (e o que não pode mostrar)

Qualquer pessoa pode abrir o inspecionar e ver **tudo o que o navegador recebeu**: código, variáveis `VITE_*`, requisições e o próprio token de login. Por isso a regra é:

> **Nada que dê poder fica no navegador. O navegador só carrega o que é público ou o que é do próprio usuário, e o banco decide.**

| Item                                                    | Pode estar no navegador?    | Por quê                                                               |
| ------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------- |
| URL do projeto Supabase e **chave `anon`**              | Sim                         | São públicas por desenho. Sozinhas não dão acesso: o que vale é o RLS |
| Token (JWT) do **próprio** usuário                      | Sim (é dele)                | Vale 1 hora; o RLS só entrega o que aquele papel e clínica podem ver  |
| Site key do Turnstile, config web do FCM                | Sim                         | Públicas por desenho                                                  |
| **Chave `service_role`**                                | **Nunca**                   | Ignora todo o RLS; equivale a ser dono do banco                       |
| **Senha do banco, JWT secret, conta de serviço do FCM** | **Nunca**                   | Só em _secrets_ das Edge Functions                                    |
| **Senhas dos usuários**                                 | **Nunca guardadas por nós** | O Supabase Auth guarda só o hash                                      |
| **Códigos de credencial em texto**                      | **Nunca no banco**          | Só o hash; o código é mostrado uma única vez à gestora                |
| Dados de outra clínica ou de outra cliente              | **Nunca**                   | O RLS nega                                                            |

Consequência prática: mesmo que alguém copie o token de outra pessoa **no aparelho dela**, só enxerga os dados dela. Contra isso: sessão curta, logout, Content Security Policy rígida (evita roubo por script injetado) e MFA.

Hoje (estado de teste) **não é assim**: a sessão e os dados estão em `localStorage`, os botões "acesso livre" entram sem senha e a credencial fica no aparelho. Tudo isso sai antes de produção (§2).

## 2. Remoções obrigatórias antes de produção

| Remover                            | Arquivo                                                               |
| ---------------------------------- | --------------------------------------------------------------------- |
| Botões de acesso livre             | `src/components/auth/free-access.tsx` e uso em `src/routes/index.tsx` |
| Contas de demonstração e `enterAs` | `src/data/mock-auth.ts`, `src/services/auth.service.ts`               |
| Qualquer senha aceita              | `authService.signIn`                                                  |
| Sessão em localStorage             | `src/lib/session.ts`                                                  |
| Credenciais no aparelho            | `src/lib/invites-store.ts`                                            |
| "Restaurar dados de exemplo"       | `src/routes/_gestor/configuracoes.tsx` (`resetDemoData`)              |
| Dados de exemplo (`seed*`)         | `src/data/db.ts`: ficam só no Supabase local (`supabase/seed.sql`)    |

## 3. Autenticação

- **Supabase Auth**, e-mail e senha, com **confirmação de e-mail obrigatória**. Política: mínimo 10 caracteres e bloqueio de senhas vazadas (opção de proteção de senha do Auth, quando disponível no plano).
- **Anti-robô**: Cloudflare Turnstile ligado no Auth (cadastro, login e recuperação).
- **Recuperação de senha** por e-mail, com resposta igual exista ou não o e-mail.
- **MFA (TOTP)** oferecido à gestora e à funcionária; recomendado ao lidar com dados de saúde.
- **Sessão**: JWT de 1 hora renovado automaticamente; ao desativar alguém, o RLS bloqueia na hora (consulta `profiles.active`) e as sessões são revogadas.
- **Limites**: rate limits do Auth configurados (tentativas de login, e-mails por hora) e SMTP próprio em produção.
- **Papéis** vêm de `profiles` (escrita só por função de servidor). Nunca de `user_metadata`.

## 4. Autorização (matriz)

`C` criar, `R` ler, `U` atualizar, `D` apagar. "própria" = só o que pertence a ela. Equipe = gestora + funcionária (ver [Equipe e permissões](./EQUIPE-E-PERMISSOES.md)).

| Recurso                                          | Gestora    | Funcionária                  | Cliente                                         | Observação                            |
| ------------------------------------------------ | ---------- | ---------------------------- | ----------------------------------------------- | ------------------------------------- |
| Clínica                                          | R U        | R                            | R (nome/contato/link de pagamento)              | Criada por RPC                        |
| Equipe e credenciais de equipe                   | C R U D    | Nada                         | Nada                                            | Só hash no banco                      |
| Clientes                                         | C R U D    | C R U D                      | R U (campos pessoais próprios)                  | Cliente não vê outras                 |
| Agenda                                           | C R U D    | C R U D                      | R (próprios); C pedido; pedir remarcar/cancelar | Cliente não aprova o próprio pedido   |
| Atendimento (rascunho, clínico)                  | C R U D    | C R U D                      | Nada                                            | Fechar só por RPC                     |
| Financeiro do atendimento, caixa, contas, custos | C R U D    | **Nada**                     | Nada                                            | Cobrança própria: ver abaixo          |
| Cobrança da cliente                              | C R U D    | **Nada**                     | R; **informar pagamento**                       | Confirmar/recusar só gestora, por RPC |
| Estoque                                          | C R U D    | C R U (sem custo/fornecedor) | Nada                                            | Custo em tabela só da gestora         |
| Fotos                                            | C R D      | C R D                        | R (próprias, se autorizado)                     | URL assinada de vida curta            |
| Anamnese                                         | C R U      | C R U                        | R (própria)                                     | Dado sensível                         |
| Histórico de eventos (auditoria)                 | R          | R (sem eventos financeiros)  | Nada                                            | Escrito só pelo servidor              |
| Avisos                                           | R U (lida) | R U (lida)                   | R U (lida)                                      | Criados pelo servidor                 |

Toda tabela de clínica tem `clinic_id`, **RLS ligado e forçado**, e política exigindo que `clinic_id` seja o da pessoa logada (ver [modelo e RLS](./SUPABASE-MODELO-E-RLS.md)). Tabela sem RLS é falha de segurança: o CI verifica isso.

## 5. Credenciais e link de cadastro

- **Link fixo da clínica** (`/?p=slug`): só revela o nome público da clínica. O cadastro cria a conta no Auth (com Turnstile) e chama `accept_invite` já logado, com limite de uso por conta e por IP.
- **Credencial de cliente** (`EB-XXXX-XXXX`): gerada no servidor, guardada como **hash**, validade de 7 dias, **uso único**, cancelável.
- **Credencial de funcionária**: validade de 48 h, amarrada ao e-mail, uso único.
- Tentativas erradas são registradas **em tabela própria** (a função devolve resultado em vez de lançar erro, para que o registro não seja desfeito) e bloqueiam a conta após o limite.
- **Resposta genérica** a código inválido ("credencial inválida ou expirada").
- A filiação à clínica é gravada pelo servidor (`profiles`), não escolhida no navegador.

## 6. Proteção do site (Cloudflare)

Cabeçalhos a definir em `src/server.ts` (hoje existe um wrapper de erro de SSR):

| Cabeçalho                    | Valor-alvo                                                                                                                                                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`    | `default-src 'self'`; `script-src 'self'` (+ nonce, + Turnstile); `connect-src` só o projeto Supabase (`https://<projeto>.supabase.co` e `wss://`), domínios do FCM e Turnstile; `img-src 'self' blob: data:` e o domínio do Storage; `frame-ancestors 'none'`; `object-src 'none'` |
| `Strict-Transport-Security`  | `max-age=63072000; includeSubDomains; preload`                                                                                                                                                                                                                                      |
| `X-Content-Type-Options`     | `nosniff`                                                                                                                                                                                                                                                                           |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`                                                                                                                                                                                                                                                   |
| `Permissions-Policy`         | `camera=(self), microphone=(), geolocation=()` (câmera só para fotos de atendimento)                                                                                                                                                                                                |
| `Cross-Origin-Opener-Policy` | `same-origin`                                                                                                                                                                                                                                                                       |

Também: HTTPS obrigatório, **WAF e limite de requisições** da Cloudflare ativos em `/` e nas rotas de recuperação.

## 7. Dados e arquivos

- **Isolamento por clínica** no Postgres (RLS) e no Storage (caminho `{clinic_id}/{client_id}/…` com política que confere a clínica).
- **Bucket de fotos privado** (nunca público). Exibição por **URL assinada** curta, e só quando `image_consent` da cliente permite. Revogar o consentimento esconde as fotos.
- **EXIF**: o `shrinkImage` já re-codifica a imagem no navegador (o que descarta a localização e dados do aparelho); validar tipo e tamanho na política do bucket. Se necessário, reforçar com Edge Function.
- **Criptografia**: em trânsito (HTTPS) e em repouso (padrão do Supabase). Campos muito sensíveis (anamnese, observações de saúde) podem receber criptografia por campo depois, se a avaliação de risco pedir.
- **Backups**: backups diários do plano Pro; **PITR** como adicional (recomendado em produção); exportação periódica para bucket privado fora do projeto; teste de restauração trimestral.
- **Auditoria**: toda ação sensível grava um evento imutável (`activity`: quem, quando, o quê), por gatilhos e RPCs; a tabela não aceita `update/delete`. Logs do Supabase (Auth, API, Postgres) mantidos e revisados.
- **Funções `SECURITY DEFINER`**: sempre com `search_path` fixo, validando `auth.uid()` e o papel dentro da função; nunca expostas sem checagem.

## 8. LGPD (Lei 13.709/2018)

Dados de saúde e imagem do rosto são **dados pessoais sensíveis** (art. 11).

| Obrigação                        | Como o app atende                                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Base legal e consentimento       | Termo versionado (editável em Configurações); aceite gravado com data e versão                                                          |
| Finalidade e minimização         | Só campos que as telas usam; sem rastreadores de terceiros                                                                              |
| Direitos do titular              | `export_client_data` e `delete_client_data` (acesso, correção, exclusão, portabilidade) com prazo de resposta                           |
| Retenção                         | Prontuário guardado pelo prazo legal/profissional definido pela clínica; política escrita                                               |
| Segurança                        | Itens deste documento                                                                                                                   |
| Incidentes                       | Plano: detectar, conter, avisar a ANPD e os titulares em prazo razoável, registrar                                                      |
| Encarregado (DPO)                | Definir contato e publicar na política de privacidade                                                                                   |
| Operadores                       | Supabase, Google (FCM) e Cloudflare são operadores: manter contratos e lista atualizada; verificar transferência internacional de dados |
| Menores de idade                 | Cadastro apenas de maiores de 18 ou com responsável (definir regra)                                                                     |
| Política de privacidade e termos | Textos finais revisados por advogado antes de abrir ao público                                                                          |

> Este documento orienta a engenharia; **não substitui revisão jurídica**.

## 9. Ciclo de desenvolvimento seguro

- Repositório: **branch protection** no `main`, revisão obrigatória, sem force push (já é regra do projeto).
- Segredos: nunca em Git; `.env*` no `.gitignore`; varredura de segredos no CI.
- Dependências: Dependabot e `bun audit` no CI; vulnerabilidades críticas em até 7 dias.
- Banco versionado em **migrações** (`supabase/migrations`), revisadas como código; nada de alterar produção pelo painel.
- CI: `tsc`, lint, build, **testes de RLS (pgTAP)**, verificação de tabela sem RLS (`supabase db lint`), testes de fluxo.
- Revisão de segurança antes de abrir ao público (§10).

## 10. Roteiro de teste de invasão (antes de produção)

Tentar, com contas de teste, e **todas devem falhar**:

1. Cliente A ler/alterar dados da cliente B.
2. Gestora da clínica X ler a clínica Y.
3. Alterar o próprio `role`/`clinic_id` em `profiles`.
4. Cliente confirmar o próprio pagamento ou aprovar o próprio horário.
5. Funcionária ler caixa, contas, custos ou valores de atendimento.
6. Reutilizar credencial usada/expirada; tentar códigos por força bruta.
7. Usar a chave `anon` direto na API REST sem login para ler tabelas.
8. Chamar RPC sem login ou com papel errado.
9. Ler foto sem URL assinada ou sem consentimento.
10. Injetar script em campos de texto (XSS) e abrir o site em `iframe` de outro domínio.
11. Procurar segredos no bundle (`grep` por `service_role`, `private_key`, `secret`).

## 11. Checklist final de produção

- [ ] Acesso livre, contas demo e `resetDemoData` removidos
- [ ] Supabase Auth com confirmação de e-mail, Turnstile e MFA oferecido
- [ ] **RLS ligado e forçado em todas as tabelas**; testes pgTAP verdes
- [ ] Papéis só em `profiles` (nunca `user_metadata`); `service_role` fora do navegador
- [ ] Credenciais com hash, validade, uso único e limite de tentativas
- [ ] Bucket de fotos privado com políticas e URL assinada
- [ ] Cabeçalhos de segurança e CSP ativos no Cloudflare; WAF ligado
- [ ] Segredos só nas secrets das funções/Cloudflare; nada sensível no bundle
- [ ] Auditoria imutável e logs do Supabase revisados
- [ ] Backups diários + PITR; restauração testada
- [ ] Alerta de uso/gasto configurado; SMTP próprio
- [ ] Termos, política de privacidade e encarregado publicados
- [ ] Roteiro de teste de invasão (§10) executado e sem falhas
