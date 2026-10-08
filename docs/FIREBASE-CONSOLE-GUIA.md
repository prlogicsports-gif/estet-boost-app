# Guia do console Firebase: onde ver e organizar tudo

Projeto. Serve para quem vai administrar o EstetBoost depois que o banco estiver ligado. Endereço do console: **console.firebase.google.com** (entre com a conta Google dona do projeto).

> Os dados de clientes (saúde e fotos) são sensíveis. Quem entra no console consegue ler tudo. Dê acesso só a quem precisa e ative o registro de auditoria (§7).

## 1. Onde fica cada coisa

| Quero…                                         | Onde no console                                                                | Observação                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Ver e editar clientes, agenda, caixa, estoque  | **Build → Firestore Database → Dados**                                         | Navegue `clinics → {clínica} → clients/appointments/ledger…`. Edição manual só em emergência: não gera auditoria do app |
| Ver quem tem conta, desativar, redefinir senha | **Build → Authentication → Users**                                             | Desativar bloqueia o login na próxima renovação do token (até 1 h)                                                      |
| Ver fotos                                      | **Build → Storage → Files**                                                    | Caminho `clinics/{clínica}/clients/{cliente}/photos/`                                                                   |
| Ver erros e execuções das funções              | **Build → Functions → Logs** (ou Google Cloud → Logging)                       | Procure por `completeSession`, `acceptInvite`                                                                           |
| Ver avisos enviados (push)                     | **Run → Cloud Messaging** e Logs das funções                                   | Estatísticas de entrega                                                                                                 |
| Conferir regras de segurança                   | **Firestore → Regras** e **Storage → Regras**                                  | Edite só pelo repositório; o console serve para ver e usar o simulador                                                  |
| Índices                                        | **Firestore → Índices**                                                        | Criados pelo `firestore.indexes.json`                                                                                   |
| Consumo e custo                                | **Uso e faturamento** (ícone de engrenagem) e Google Cloud → Billing           | Configure alerta de orçamento                                                                                           |
| Segurança de chamadas (robôs)                  | **Build → App Check**                                                          | Deve estar em modo "enforce" em produção                                                                                |
| Backups                                        | Google Cloud → Firestore → Backups/PITR e Cloud Storage (bucket de exportação) | Testar restauração a cada trimestre                                                                                     |

## 2. Ver e organizar o banco no dia a dia

- **Navegar**: Firestore Database → Dados. Cada clínica é um documento em `clinics`; dentro dele ficam as subcoleções.
- **Filtrar**: botão de filtro no topo de cada coleção (por exemplo `ledger` onde `kind == receber`).
- **Exportar para planilha/relatórios**: ativar a extensão **Stream Firestore to BigQuery** e usar **Looker Studio** (gratuito) para painéis. Alternativa simples: exportação agendada para Cloud Storage.
- **Dados de teste**: use o **Emulator UI** (`http://localhost:4000`) no ambiente Docker; nunca teste no projeto de produção.

## 3. Quem acessa o console (papéis)

No Google Cloud → IAM, dê o menor papel possível:

| Pessoa             | Papel sugerido                                                          |
| ------------------ | ----------------------------------------------------------------------- |
| Dono(a) do projeto | Proprietário (1 ou 2 pessoas, com MFA obrigatório)                      |
| Desenvolvedor      | Editor de Firebase **no dev/staging**; no prod, só visualizador de logs |
| Suporte            | Visualizador de Authentication (sem acesso ao Firestore de saúde)       |

Ative **verificação em duas etapas** em todas as contas Google com acesso ao projeto.

## 4. Criar o projeto (primeira vez)

1. Console → **Adicionar projeto** → nome `estetboost-prod` (repetir para `-staging` e `-dev`).
2. **Authentication → Método de login**: ativar **E-mail/senha**; ativar **verificação de e-mail**.
3. **Firestore Database → Criar banco** → modo **produção** (nega tudo) → região **southamerica-east1 (São Paulo)**.
4. **Storage → Começar** → modo produção, mesma região.
5. **Functions**: atualizar para **Blaze** (cartão exigido; o uso inicial costuma caber na cota gratuita).
6. **App Check**: registrar o app web com **reCAPTCHA Enterprise**; começar em modo "monitorar" e passar a "enforce" ao final dos testes.
7. **Configurações do projeto → Seus apps → Web**: copiar a config web. Ela é **pública** e vai em variáveis `VITE_*`.
8. Google Cloud: **Faturamento → Orçamentos e alertas** (ex.: alerta em R$ 50, 100 e 200).

**Não copie para o app**: conta de serviço (JSON), chave privada, qualquer "server key". Isso só existe em funções, via Secret Manager.

## 5. Rotina de manutenção

| Quando                           | O que                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------- |
| Diário                           | Olhar alertas de erro das funções                                            |
| Semanal                          | Conferir uso/custo e `bun audit`                                             |
| Mensal                           | Revisar quem tem acesso ao console; revisar contas desativadas               |
| Trimestral                       | Testar restauração de backup; revisar regras e o roteiro de teste de invasão |
| Sempre que sair alguém da equipe | Remover do IAM e do GitHub no mesmo dia                                      |

## 6. Incidente (suspeita de acesso indevido)

1. **Contenção**: desativar usuários suspeitos (Authentication); se necessário, trocar regras para negar tudo temporariamente (publicando regras mínimas).
2. **Investigação**: Cloud Audit Logs (quem leu/escreveu), logs de Functions, `activity` do app.
3. **Rotação**: renovar segredos (Secret Manager), conta de serviço, `pepper` das credenciais.
4. **Comunicação**: avisar clientes afetados e a ANPD no prazo da LGPD; registrar tudo.

## 7. Auditoria do console

Google Cloud → **IAM e administrador → Registros de auditoria**: ligar **Leitura de dados** e **Gravação de dados** para Cloud Firestore e Cloud Storage. Assim cada acesso humano ao banco fica registrado.
