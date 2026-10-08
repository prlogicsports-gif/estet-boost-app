# Segurança e privacidade

Projeto de normas e checklist. **Ainda não implementado.** O estado atual do app é só para validar fluxos: não use com dados reais de clientes.

## 1. O que o "inspecionar" mostra (e o que não pode mostrar)

Qualquer pessoa pode abrir o inspecionar e ver **tudo o que o navegador recebeu**: código, variáveis `VITE_*`, requisições e o próprio token de login. Por isso a regra é:

> **Nada que dê poder fica no navegador. O navegador só carrega o que é público ou o que é do próprio usuário, e o servidor decide.**

| Item                                            | Pode estar no navegador? | Por quê                                                                 |
| ----------------------------------------------- | ------------------------ | ----------------------------------------------------------------------- |
| Config web do Firebase (`apiKey`, `projectId`…) | Sim                      | É identificador público. Sozinha não dá acesso a nada                   |
| Token de login do **próprio** usuário           | Sim (é dele)             | Vale 1 hora, só permite o que as regras permitem àquele papel e clínica |
| Site key do App Check                           | Sim                      | Pública por desenho                                                     |
| **Conta de serviço / Admin SDK**                | **Nunca**                | Ignora todas as regras                                                  |
| **Chaves de servidor do FCM, e-mail, segredos** | **Nunca**                | Só em Cloud Functions (Secret Manager)                                  |
| **Senhas**                                      | **Nunca guardadas**      | O Firebase Auth guarda só o hash; o app nunca vê a senha                |
| **Códigos de credencial em texto**              | **Nunca no banco**       | Só o hash; o código é mostrado uma única vez à gestora                  |
| Dados de outra clínica ou de outra cliente      | **Nunca**                | As regras do Firestore/Storage negam                                    |

Consequência prática: mesmo que alguém copie o token de outra pessoa **no próprio aparelho dela**, só enxerga os dados dela. Contra isso: sessão curta, logout, Content Security Policy rígida (evita roubo por script injetado) e MFA opcional.

Hoje (estado de teste) **não é assim**: a sessão e os dados estão em `localStorage`, os botões "acesso livre" entram sem senha e a credencial de cadastro fica no aparelho. Tudo isso sai antes de produção (§2).

## 2. Remoções obrigatórias antes de produção

| Remover                            | Arquivo                                                               |
| ---------------------------------- | --------------------------------------------------------------------- |
| Botões de acesso livre             | `src/components/auth/free-access.tsx` e uso em `src/routes/index.tsx` |
| Contas de demonstração e `enterAs` | `src/data/mock-auth.ts`, `src/services/auth.service.ts`               |
| Qualquer senha aceita              | `authService.signIn`                                                  |
| Sessão em localStorage             | `src/lib/session.ts`                                                  |
| Credenciais no aparelho            | `src/lib/invites-store.ts`                                            |
| "Restaurar dados de exemplo"       | `src/routes/_gestor/configuracoes.tsx` (`resetDemoData`)              |
| Dados de exemplo (`seed*`)         | `src/data/db.ts`: ficam só no emulador                                |

## 3. Autenticação

- **Firebase Authentication**, e-mail e senha. Política: mínimo 10 caracteres, bloquear senhas vazadas comuns, verificação de e-mail antes de acessar dados.
- **Recuperação de senha** por e-mail oficial do Firebase, com resposta igual exista ou não o e-mail (evita descobrir quem tem conta).
- **MFA** (segundo fator) opcional para esteticista, recomendado ao lidar com dados de saúde.
- **Sessão**: token de 1 hora renovado automaticamente; logout em todos os aparelhos ao trocar senha; desativar conta pelo console.
- **Limite de tentativas**: proteção nativa do Firebase Auth + App Check contra robôs.
- **Papéis (`gestor`/`cliente`)** vêm de custom claims gravadas só por função de servidor. O campo "role" **nunca** é lido de dado editável pelo usuário.

## 4. Autorização (matriz)

`C` = criar, `R` = ler, `U` = atualizar, `D` = apagar. "própria" = só o que pertence a ela.

| Recurso                               | Gestora (própria clínica) | Cliente                                         | Observação                                  |
| ------------------------------------- | ------------------------- | ----------------------------------------------- | ------------------------------------------- |
| Clínica                               | R U                       | R (nome/contato)                                | Criada por função                           |
| Clientes                              | C R U D                   | R U (campos pessoais próprios)                  | Cliente não vê outras                       |
| Agenda                                | C R U D                   | R (próprios); C pedido; pedir remarcar/cancelar | Cliente não aprova o próprio pedido         |
| Atendimento (rascunho)                | C R U D                   | Nada                                            | Fechar só por função                        |
| Caixa, contas, estoque, procedimentos | C R U D                   | Nada                                            | Cliente vê só as próprias cobranças         |
| Cobrança da cliente                   | C R U D                   | R; **informar pagamento** (campo `reported`)    | Confirmar/recusar só gestora, por função    |
| Fotos                                 | C R D                     | R (próprias, se autorizado)                     | URL assinada de vida curta                  |
| Anamnese                              | C R U                     | R (própria)                                     | Dado sensível                               |
| Histórico de eventos (auditoria)      | R                         | Nada                                            | Somente escrito por servidor; ninguém edita |
| Notificações                          | R U (lida)                | R U (lida)                                      | Criadas por função                          |
| Credenciais de cadastro               | C (via função), cancelar  | Nada                                            | Só hash no banco                            |

Toda leitura/escrita de dado de clínica exige `request.auth.token.clinicId == clinicId` nas regras (ver [modelo e regras](./FIRESTORE-MODELO-E-REGRAS.md)).

## 5. Credenciais e link de cadastro da cliente

- **Link fixo da clínica** (`/?p=slug`): só revela o nome público da clínica; o cadastro passa por `acceptInvite` com App Check e limite de uso por IP/aparelho.
- **Credencial individual** (`EB-XXXX-XXXX`): gerada no servidor, guardada como **hash**, validade de 7 dias, **uso único**, cancelável. Tentativas erradas são contadas e bloqueadas.
- **Resposta genérica** a código inválido ("credencial inválida ou expirada"): não diz se existiu.
- A cliente entra **filiada à clínica dona da credencial**; essa filiação é gravada no servidor (claims), não escolhida no navegador.

## 6. Proteção do site (Cloudflare)

Cabeçalhos a definir em `src/server.ts` (hoje existe um wrapper de erro de SSR):

| Cabeçalho                    | Valor-alvo                                                                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`    | `default-src 'self'`; `script-src 'self'` (+ nonce); `connect-src` só `*.googleapis.com`, `*.firebaseio.com` e domínios do Firebase usados; `img-src 'self' blob: data:`; `frame-ancestors 'none'`; `object-src 'none'` |
| `Strict-Transport-Security`  | `max-age=63072000; includeSubDomains; preload`                                                                                                                                                                          |
| `X-Content-Type-Options`     | `nosniff`                                                                                                                                                                                                               |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`                                                                                                                                                                                       |
| `Permissions-Policy`         | `camera=(self), microphone=(), geolocation=()` (câmera só para fotos de atendimento)                                                                                                                                    |
| `Cross-Origin-Opener-Policy` | `same-origin`                                                                                                                                                                                                           |

Também: HTTPS obrigatório, **WAF e limite de requisições** da Cloudflare ativos, bloqueio de bots em `/` (cadastro) e rotas de recuperação.

## 7. Dados e arquivos

- **Isolamento por clínica** em Firestore e Storage (caminho `clinics/{clinicId}/…`).
- **Fotos**: envio com redução de tamanho (já existe `shrinkImage`), **remoção de EXIF** (localização e dados do aparelho) no servidor, exibição por URL assinada curta, e **só** quando `imageConsent` da cliente permite o uso. Revogar o consentimento esconde as fotos para fins que dependam dele.
- **Criptografia**: em trânsito (HTTPS) e em repouso (padrão do Google Cloud). Campos muito sensíveis (anamnese, observações de saúde) podem receber criptografia por campo numa fase posterior, se a avaliação de risco pedir.
- **Backups**: recuperação pontual (PITR) do Firestore e exportação agendada para bucket privado; teste de restauração trimestral.
- **Auditoria**: toda ação sensível grava um evento imutável (quem, quando, o quê). Evolução do `activityDb` atual. Cloud Audit Logs ativados para quem acessa o console.

## 8. LGPD (Lei 13.709/2018)

Dados de saúde e imagem do rosto são **dados pessoais sensíveis** (art. 11).

| Obrigação                        | Como o app atende                                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Base legal e consentimento       | Termo versionado (já editável em Configurações); aceite gravado com data, versão e IP/aparelho                    |
| Finalidade e minimização         | Só campos que as telas usam; sem rastreadores de terceiros                                                        |
| Direitos do titular              | Funções `exportClientData` e `deleteClientData` (acesso, correção, exclusão, portabilidade) com prazo de resposta |
| Retenção                         | Prontuário guardado pelo prazo legal/profissional definido pela clínica; política escrita                         |
| Segurança                        | Itens deste documento                                                                                             |
| Incidentes                       | Plano: detectar, conter, avisar a ANPD e os titulares em prazo razoável, registrar                                |
| Encarregado (DPO)                | Definir contato e publicar na política de privacidade                                                             |
| Operadores                       | Google Cloud/Firebase e Cloudflare são operadores: manter contratos e lista atualizada                            |
| Menores de idade                 | Cadastro apenas de maiores de 18 ou com responsável (definir regra)                                               |
| Política de privacidade e termos | Textos finais revisados por advogado antes de abrir ao público                                                    |

> Este documento orienta a engenharia; **não substitui revisão jurídica**.

## 9. Ciclo de desenvolvimento seguro

- Repositório: **branch protection** no `main`, revisão obrigatória, commits assinados (opcional), sem force push (já é regra do projeto).
- Segredos: nunca em Git; `.env*` no `.gitignore`; varredura de segredos no CI.
- Dependências: Dependabot e `bun audit` no CI; atualizar vulnerabilidades críticas em até 7 dias.
- CI (GitHub Actions): `tsc`, lint, build, **testes das regras do Firestore/Storage no emulador**, testes de fluxo.
- Regras e funções publicadas só pelo pipeline, por ambiente.
- Revisão de segurança antes de abrir ao público (§10).

## 10. Roteiro de teste de invasão (antes de produção)

Tentar, com contas de teste, e **todas devem falhar**:

1. Cliente A ler/alterar dados da cliente B.
2. Gestora da clínica X ler a clínica Y.
3. Alterar `role`/`clinicId` do próprio perfil.
4. Cliente confirmar o próprio pagamento ou aprovar o próprio horário.
5. Reutilizar uma credencial já usada ou expirada; forçar código por tentativa e erro.
6. Chamar função sem login ou sem App Check.
7. Ler foto sem URL assinada ou sem consentimento.
8. Injetar script em campos de texto (nome, observações) e ver se executa (XSS).
9. Abrir o site em `iframe` de outro domínio (clickjacking).
10. Procurar segredos no bundle (`grep` por `private_key`, `service_account`, `secret`).

## 11. Checklist final de produção

- [ ] Acesso livre, contas demo e `resetDemoData` removidos
- [ ] Firebase Auth ativo; e-mail verificado; MFA oferecido
- [ ] Regras Firestore/Storage: negar por padrão + testes verdes
- [ ] App Check ativo (enforce) em Auth, Firestore, Storage e Functions
- [ ] Custom claims só por função; sem papel lido de dado editável
- [ ] Credenciais com hash, validade, uso único e limite de tentativas
- [ ] Cabeçalhos de segurança e CSP ativos no Cloudflare; WAF ligado
- [ ] Segredos só em Secret Manager/Cloudflare; nada sensível no bundle
- [ ] Auditoria imutável e Cloud Audit Logs ligados
- [ ] Backups agendados + restauração testada
- [ ] Alerta de orçamento configurado
- [ ] Termos, política de privacidade e encarregado publicados
- [ ] Roteiro de teste de invasão (§10) executado e sem falhas
