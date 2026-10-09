# Push com o app fechado: como ligar

Como funciona: cada aviso novo entra na tabela `notifications` (pelo app ou pelos lembretes agendados). Um gatilho do banco chama a função `send-push`, que envia o push pelo Firebase Cloud Messaging. O service worker do app (`public/sw.js`) mostra a notificação, mesmo com o app fechado. Os lembretes (horários, contas, cobranças, estoque, validade, cuidados, clientes paradas) rodam sozinhos no servidor a cada 5 minutos (`app.run_reminders`, via pg_cron).

> **Nunca** cole o JSON da conta de serviço no chat, no repositório ou em arquivo do app. Ele só vai no campo de _secret_ do Supabase (passo 3).

## 1. Banco (uma vez)

No SQL Editor, rode `supabase/migrations/20260101000007_push_reminders.sql` (depois das migrações 04, 05 e 06). Se aparecer erro de extensão, ligue **pg_net** e **pg_cron** em _Database → Extensions_ e rode o arquivo de novo.

## 2. Chave do Firebase

Console do Firebase (projeto `estetboost`) → ⚙ _Configurações do projeto_ → _Contas de serviço_ → **Gerar nova chave privada**. Baixa um arquivo `.json`. Guarde-o bem e não envie a ninguém.

## 3. Função no Supabase

1. _Edge Functions → Deploy a new function → Via Editor_, nome **`send-push`**, e cole o conteúdo de `supabase/functions/send-push/index.ts`.
2. Em _Function Settings_ desligue **Verify JWT** (a função se protege sozinha com um segredo).
3. _Edge Functions → Secrets_, crie:
   - `PUSH_SECRET`: um texto longo e aleatório (por exemplo, 40 letras e números misturados). Anote para o passo 4.
   - `FCM_SERVICE_ACCOUNT`: abra o `.json` do passo 2, copie **tudo** e cole como valor.
4. Faça o deploy.

## 4. Ligar o gatilho ao endereço da função

No SQL Editor (troque o segredo pelo mesmo valor de `PUSH_SECRET`):

```sql
insert into app.secrets (name, value) values
  ('push_url', 'https://eqlbauyaegkilvamxwzd.supabase.co/functions/v1/send-push'),
  ('push_secret', 'COLE-AQUI-O-MESMO-VALOR-DO-PUSH_SECRET')
on conflict (name) do update set value = excluded.value;
```

## 5. Ativar no aparelho

No app, **Configurações → Avisos → Notificações no aparelho**: ligue e permita quando o navegador pedir. O aparelho se registra sozinho. Quem usa o app em mais de um aparelho liga em cada um.

- **Android e computador (Chrome, Edge):** funciona direto.
- **iPhone/iPad:** o push só funciona depois de instalar o app na tela inicial (Compartilhar → Adicionar à Tela de Início) e abri-lo pelo ícone **EB.**; veja [PWA.md](./PWA.md).

## 6. Testar

1. Com o app **fechado** (ou em outra aba), rode no SQL Editor: `select app.run_reminders();` ou crie um horário para daqui a poucos minutos.
2. O aviso aparece na central do app e o push chega ao aparelho em alguns segundos.
3. Se não chegar: _Edge Functions → send-push → Logs_ mostra o motivo (segredo errado, JSON inválido, aparelho sem permissão).

## Segurança

- A função só aceita chamadas com `x-push-secret` correto; sem ele, responde 401.
- O push respeita as preferências de cada pessoa (liga/desliga geral e por categoria).
- Aparelhos que desinstalam o app saem da lista sozinhos; ao **sair da conta**, o aparelho é removido na hora.
- Se o segredo vazar, troque `PUSH_SECRET` e rode o SQL do passo 4 com o novo valor.
