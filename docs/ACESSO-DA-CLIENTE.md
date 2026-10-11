# Acesso da cliente ao app (conta criada pela gestora)

No cadastro de cliente a gestora pode ligar **"Criar acesso ao app agora"**, definir (ou gerar) a senha e enviar o acesso pelo WhatsApp. Quando a cliente abre o link e entra com o e-mail e a senha, a conta já existe: não há cadastro nem confirmação de e-mail. Na ficha da cliente há o botão **Acesso ao app** (criar, ou redefinir a senha).

## Como funciona

1. A ficha é criada no app (fila do aparelho) e enviada ao servidor.
2. O app chama a Edge Function `create-client-account` com o login de quem está logada.
3. A função confere que quem chama é gestora (ou funcionária com permissão de **clientes**) e que a ficha é da mesma clínica; cria o usuário no Supabase Auth (já confirmado) e liga à ficha (`client_access_event`, só a chave de serviço executa).
4. No primeiro acesso a cliente vê a tela **Bem-vinda** e precisa aceitar os termos (`accept_terms`); a gestora não aceita por ela.

A senha só viaja até o Auth: não fica guardada no banco, nem em log. A tela de sucesso é o único lugar onde ela aparece. Limite: 40 acessos criados/redefinidos por hora por clínica.

## Publicar (uma vez)

1. SQL Editor: rode `supabase/migrations/20260101000015_link_client_account.sql`.
2. Edge Functions → **Deploy a new function → Via Editor**, nome **`create-client-account`**, cole o conteúdo de `supabase/functions/create-client-account/index.ts`.
3. Em _Function Settings_ **desligue "Verify JWT"** (a função confere o login sozinha e responde ao pré-voo do navegador).
4. Faça o deploy. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem na função; não crie secrets novos.

## Mensagens de erro que a gestora pode ver

| Mensagem                                         | Causa                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| Esse e-mail já tem conta                         | já existe usuário com o e-mail; a cliente entra com ele ou use outro |
| A função de criar acesso ainda não foi publicada | passo 2 não feito                                                    |
| A ficha ainda não chegou ao servidor             | sem internet no momento do cadastro; tente de novo                   |
| Muitos acessos criados nesta hora                | limite por clínica                                                   |

Sem internet o cadastro da ficha continua funcionando; o acesso pode ser criado depois pelo botão da ficha.
