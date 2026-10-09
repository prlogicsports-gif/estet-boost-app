# Equipe da clínica: acesso de funcionária

Decisão: uma clínica pode ter profissionais trabalhando com acesso próprio. A gestora gera uma **credencial** e a pessoa entra com o papel **`funcionario`**: acessa tudo da clínica **menos o financeiro**. Este documento complementa e, onde houver conflito, **prevalece sobre** [Arquitetura](./ARQUITETURA.md) (§3 e §4), [Segurança](./SEGURANCA-PRIVACIDADE.md) (§4 matriz), [Modelo do banco e RLS](./SUPABASE-MODELO-E-RLS.md) e [Fluxos](./FLUXOS.md).

## 1. Papéis

| Papel         | Claims                                    | Resumo                                                  |
| ------------- | ----------------------------------------- | ------------------------------------------------------- |
| `gestor`      | `role=gestor`, `clinicId`                 | Dona da clínica: tudo, inclusive financeiro e equipe    |
| `funcionario` | `role=funcionario`, `clinicId`, `staffId` | Tudo da clínica, **sem financeiro** e sem administração |
| `cliente`     | `role=cliente`, `clinicId`, `clientId`    | Só os próprios dados                                    |

Uma clínica tem **uma** gestora (dona) e **várias** funcionárias. A gestora é a única que cria, vê e desativa credenciais de equipe.

## 2. O que a funcionária vê e faz (premissas, a confirmar)

| Área                                                                                          | Funcionária                                             | Observação                                                                   |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Hoje, Agenda, bloqueios do dia                                                                | Sim                                                     | Agenda e aprova horários                                                     |
| Clientes, ficha, anamnese, fotos, histórico                                                   | Sim                                                     | Cadastra e edita clientes                                                    |
| Atendimento (wizard, antes/depois, produtos)                                                  | Sim                                                     | Fecha atendimento; o lançamento no caixa é feito pelo servidor, ela não o vê |
| Estoque (quantidade, validade, lote, tipo)                                                    | Sim                                                     | **Sem custo por unidade e sem fornecedor**                                   |
| Avisos                                                                                        | Sim                                                     | Só os de atendimento, estoque e clientes                                     |
| **Gestão → Caixa, A receber, Contas**                                                         | **Não**                                                 | Aba some do menu; regras negam                                               |
| Confirmar ou recusar pagamento informado                                                      | **Não**                                                 | Fica com a gestora                                                           |
| Valores recebidos, custo de produto, margem, alerta de margem                                 | **Não**                                                 | A tela de atendimento não mostra custo nem sobra para ela                    |
| Preço dos procedimentos                                                                       | Sim (leitura)                                           | Necessário para agendar; **edição só da gestora**                            |
| Corrigir atendimento já finalizado                                                            | Sim, **sem mexer em valores**                           | Valor e forma de pagamento só da gestora                                     |
| Histórico de eventos                                                                          | Sim, **sem eventos financeiros**                        | Eventos de pagamento ficam ocultos                                           |
| Configurações da clínica, perfil da dona, link e credenciais, horários, procedimentos, termos | **Não**                                                 | Só a gestora                                                                 |
| Equipe (convidar, desativar)                                                                  | **Não**                                                 | Só a gestora                                                                 |
| Exportar prontuário e direitos do titular                                                     | Sim para prontuário; **exclusão de dados só a gestora** | Responsabilidade LGPD é da clínica                                           |

Se quiser outro desenho (por exemplo, funcionária sem acesso ao estoque ou com acesso aos valores de procedimento), é só ajustar esta tabela.

## 3. Como entra (credencial de equipe)

```mermaid
sequenceDiagram
  participant G as Gestora
  participant F as Funcionária
  participant App as App
  participant Auth as Supabase Auth
  participant DB as Postgres
  G->>DB: rpc create_staff_invite(nome, e-mail)
  DB->>DB: só gestora da clínica; limite de convites pendentes
  DB->>DB: invites: só o hash, role=funcionario, clinic_id, validade 48 h, uso único
  G->>F: envia link ou código (WhatsApp)
  F->>App: abre o link, cria senha (o e-mail precisa ser o do convite)
  App->>Auth: signUp (Turnstile) e confirma o e-mail
  App->>DB: rpc accept_staff_invite(request_id, código)
  DB->>DB: código válido, não usado, não expirado, e-mail confere
  DB->>DB: transação: profiles(role=funcionario, clinic_id, active), marca uso
  DB->>DB: activity e aviso à gestora
```

- Credencial de equipe é **diferente** da de cliente: validade menor (48 h), amarrada ao e-mail, exige **e-mail confirmado** e recomenda **MFA**.
- A gestora **desativa** uma funcionária a qualquer momento (`disable_staff`): marca `profiles.active = false` e revoga as sessões. Como o RLS consulta `profiles.active` a cada acesso, **o bloqueio é imediato**, sem esperar o token expirar.
- O que a funcionária faz fica registrado com o `staff_id` (quem atendeu, quem corrigiu o quê).

## 4. Mudanças no modelo e nas políticas

Detalhes completos em [SUPABASE-MODELO-E-RLS.md](./SUPABASE-MODELO-E-RLS.md). Em resumo:

- `profiles.role` aceita `funcionario`; `invites.role` distingue credencial de cliente e de equipe (com `email_hint`).
- **Financeiro isolado em tabelas que só a gestora lê**: `ledger`, `bills`, `stock_costs` (custo e fornecedor), `session_finance` (valores cobrados, pagamento, custo) e `appointment_finance` (valor combinado do horário). O RLS protege linhas, não colunas; por isso o dinheiro mora em tabelas separadas.
- `activity.sensitive` marca eventos financeiros; a funcionária lê só `sensitive = false`.
- Funções auxiliares do banco: `app.is_gestor()` (financeiro e administração) e `app.is_team()` (gestora ou funcionária: clientes, agenda, anamnese, fotos, rascunho de atendimento, estoque sem custo, leitura de procedimentos).
- A funcionária **não** altera valores nem o estado financeiro em nenhum caminho; as RPCs financeiras exigem `app.is_gestor()` dentro da função.

Testes de RLS da equipe (somar aos de SUPABASE-MODELO-E-RLS.md §7):

| Teste                                                                                     | Esperado               |
| ----------------------------------------------------------------------------------------- | ---------------------- |
| Funcionária lê `ledger`, `bills`, `stock_costs`, `session_finance`, `appointment_finance` | 0 linhas               |
| Funcionária lê estoque (sem custo), agenda e clientes da própria clínica                  | Permitido              |
| Funcionária edita preço de procedimento                                                   | Negado                 |
| Funcionária cria credencial ou lê credenciais/equipe                                      | Negado                 |
| Funcionária da clínica X lê a clínica Y                                                   | 0 linhas               |
| Funcionária desativada (`active=false`) acessa qualquer tabela                            | 0 linhas imediatamente |
| Credencial de equipe usada duas vezes ou com e-mail diferente                             | `{ok:false}`           |
| Funcionária confirma pagamento ou fecha atendimento alterando valor                       | Negado                 |

## 5. Mudanças nas telas (na implementação)

- Menu e rotas por papel: funcionária **não vê** Gestão (Caixa/Contas), Credenciais e Configurações (só "Meu perfil" e "Avisos").
- `RoleGate` passa a aceitar lista de papéis (`gestor`, `funcionario`) e a bloquear rota financeira para funcionária.
- Atendimento: etapa "Produtos" mostra quantidade sem custo; resumo de pagamento e margem **não aparecem**; a etapa 9 pede só o que a funcionária pode decidir (retorno e cuidados), e o valor vem do procedimento.
- Ficha da cliente: aba **Financeiro** oculta para funcionária.
- Gestora ganha **Configurações → Equipe**: convidar, ver ativas/pendentes, desativar.
- Textos de aviso da funcionária excluem pagamentos e margem; `notification-events.ts` ganha o público `equipe` (atendimento, estoque, clientes) separado de `gestor` (inclui financeiro).

## 6. Pendências que isso abre

1. **Quem recebe o aviso de novo atendimento/horário**: só a gestora, a funcionária designada, ou toda a equipe? (Hoje assume toda a equipe.)
2. **Agenda por profissional**: cada atendimento tem uma profissional responsável? Isso permite agenda e relatórios por pessoa e comissão no futuro.
3. **Comissão ou repasse**: hoje fora do escopo; se vier, é financeiro e fica só com a gestora.
4. **Limite de funcionárias** por plano da clínica (se houver planos).
