# Equipe da clínica: acesso de funcionária

Decisão: uma clínica pode ter profissionais trabalhando com acesso próprio. A gestora gera uma **credencial** e a pessoa entra com o papel **`funcionario`**: acessa tudo da clínica **menos o financeiro**. Este documento complementa e, onde houver conflito, **prevalece sobre** [Arquitetura](./ARQUITETURA.md) (§3 e §4), [Segurança](./SEGURANCA-PRIVACIDADE.md) (§4 matriz), [Firestore e regras](./FIRESTORE-MODELO-E-REGRAS.md) e [Fluxos](./FLUXOS.md).

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
  participant Fn as Funções
  participant FS as Firestore
  G->>Fn: createStaffInvite({nome, e-mail})
  Fn->>Fn: só gestora da clínica; limite de convites pendentes
  Fn->>FS: invites/{hash}: role=funcionario, clinicId, validade 48 h, uso único
  G->>F: envia link ou código (WhatsApp)
  F->>App: abre o link, cria nome e senha (e-mail do convite)
  App->>Fn: acceptStaffInvite({requestId, código, dados})
  Fn->>Fn: código válido, não usado, não expirado, e-mail confere
  Fn->>FS: transação: clinics/{id}/staff/{uid}, users/{uid}, marca uso
  Fn->>Fn: claims role=funcionario, clinicId, staffId
  Fn->>FS: activity e aviso à gestora
```

- Credencial de equipe é **diferente** da de cliente: validade menor (48 h), amarrada ao e-mail, exige **e-mail verificado** e recomenda **MFA**.
- A gestora **desativa** uma funcionária a qualquer momento (função `disableStaff`: desativa o login, revoga tokens e marca `active=false`); o acesso cai na próxima renovação do token, no máximo em 1 hora, ou na hora com revogação.
- O que a funcionária faz fica registrado com o `staffId` (quem atendeu, quem corrigiu o quê).

## 4. Mudanças no modelo e nas regras

Novas peças:

- `clinics/{id}/staff/{uid}`: `{ name, email, active, createdAt, createdBy }`.
- `invites/{hash}` ganha `role: "cliente" | "funcionario"` e `emailHint`.
- **Financeiro isolado em caminhos que só a gestora lê**: `clinics/{id}/ledger`, `bills` (já separados) e `stock/{id}/private/cost` (custo e fornecedor saem do documento principal do estoque).
- `sessions` finalizadas: o resumo financeiro (`totals`, `paidNow`, `payment`, `procedures[].price` cobrado) fica em `sessions/{id}/private/finance`, lido só pela gestora.
- `activity` ganha `sensitive: boolean` (eventos financeiros); a funcionária lê apenas `sensitive == false`.

Funções auxiliares nas regras:

```
function isStaff(c)   { return inClinic(c) && role() == 'funcionario'; }
function isPro(c)     { return isGestor(c) || isStaff(c); }   // "equipe"
```

- Onde hoje está `isGestor(c)` para **clientes, agenda, anamnese, fotos, rascunho de atendimento, estoque (sem custo), blocks e procedures (leitura)**, passa a valer `isPro(c)`.
- Onde é financeiro ou administração (`ledger`, `bills`, `private/*`, `config` de clínica, `procedures` escrita, `staff`, `invites`), continua `isGestor(c)`.
- Funcionária **não** pode alterar campos de valor nem `reported`/estado financeiro em nenhum caminho.

Novos testes das regras (somar aos de FIRESTORE §7):

| Teste                                                         | Esperado                  |
| ------------------------------------------------------------- | ------------------------- |
| Funcionária lê `ledger`, `bills` ou `private/*`               | Negado                    |
| Funcionária lê estoque (sem custo) e agenda                   | Permitido                 |
| Funcionária lê `stock/{id}/private/cost`                      | Negado                    |
| Funcionária edita preço de procedimento                       | Negado                    |
| Funcionária cria credencial ou lê `staff` de outros           | Negado                    |
| Funcionária de clínica X lê clínica Y                         | Negado                    |
| Funcionária desativada (`active=false`) acessa algo           | Negado após revogar token |
| Credencial de equipe usada duas vezes ou com e-mail diferente | Negado                    |
| Funcionária confirma pagamento ou fecha com valor alterado    | Negado                    |

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
