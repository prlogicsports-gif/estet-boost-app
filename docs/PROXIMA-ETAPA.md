# Próxima etapa: banco de dados, fluxos e auditoria

> **Projeto aprovado em documentos** (Firebase, site na Cloudflare via Lovable, Docker só para o emulador):
> [Arquitetura](./ARQUITETURA.md) · [Segurança e privacidade](./SEGURANCA-PRIVACIDADE.md) · [Firestore e regras](./FIRESTORE-MODELO-E-REGRAS.md) · [Fluxos](./FLUXOS.md) · [Docker e deploy](./AMBIENTE-DOCKER-E-DEPLOY.md) · [Guia do console Firebase](./FIREBASE-CONSOLE-GUIA.md)
>
> **Ordem de implementação:** 1) projetos Firebase dev/staging/prod + Blaze com alerta de orçamento (você, com o guia) → 2) emulador em Docker + regras negando tudo + testes das regras → 3) Auth real, claims, `createClinic` e `acceptInvite`; remover acesso livre e contas demo → 4) trocar `src/services/*` por Firestore, uma área por vez (clientes, agenda, atendimento/caixa/estoque, avisos, fotos) → 5) cabeçalhos de segurança, App Check, push e agendador → 6) teste de invasão e só então auditoria de código e PWA.
>
> **Você precisa fornecer:** conta Google, cartão para o plano Blaze, domínio próprio, e-mail do encarregado de dados (LGPD) e as respostas às decisões em aberto de `ARQUITETURA.md` §8.

O app já roda **sem banco** (tudo em `localStorage`/IndexedDB, atrás de `src/services/*`). Esta etapa troca a camada local por um backend real **sem mexer nas telas**, e só depois faz a auditoria de código.

## 1. O que o app já faz (e precisa persistir)

| Área        | Telas                                                                                                   | Dados                                        |
| ----------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Acesso      | login, criar conta (cria a **clínica**), link/credencial da clínica                                     | `Session`, `ClinicRec`, credenciais          |
| Clientes    | carteira, ficha, cadastro completo, edição, anamnese, exportar prontuário                               | `ClientRec` (com `clinicId`), `AnamnesisRec` |
| Agenda      | agendar, solicitar, aprovar, remarcar, cancelar, bloqueios, horários                                    | `AppointmentRec`, `BlockRec`, `HoursRec`     |
| Atendimento | wizard em 9 etapas, rascunho salvo sozinho, antes/depois, procedimentos, produtos                       | `SessionRec`, `ProcedureRec`, fotos (blobs)  |
| Gestão      | caixa, a receber (confirmar/recusar pagamento informado), contas, estoque (validade, tipo, lote, custo) | `LedgerEntry`, `BillRec`, `StockRec`         |
| Avisos      | central, preferências, regras agendadas                                                                 | `NotificationRec`, `NotificationPrefs`       |

## 2. O que falta antes de começar

1. **Escolher o backend.** Firebase (Auth + Firestore + Storage + FCM + Functions) ou Supabase (Auth + Postgres + Storage + Edge Functions). Decide: o modelo relacional (carteira, caixa e estoque pedem relatórios) pesa a favor de Postgres; push e tempo real, a favor de Firebase. Notificações já estão especificadas para Firebase em `docs/NOTIFICACOES-FIREBASE.md`.
2. **Autenticação real.** Hoje qualquer senha entra e o perfil vem de contas de demonstração. Falta: senha de verdade, recuperação, sessão no servidor e o botão "Acesso livre" removido.
3. **Isolamento por clínica (`clinicId`).** Clientes e agendamentos já são filtrados por clínica. **Caixa, contas, estoque, procedimentos, horários, bloqueios e configurações ainda são globais do aparelho**: no banco todos precisam de `clinicId` e de regras de segurança por clínica.
4. **Link e credenciais.** Hoje as credenciais ficam no aparelho de quem as gerou, então um link aberto em outro aparelho não acha a clínica. No banco: coleção `convites` (código, `clinicId`, validade, usado) e página de cadastro que resolve `?p=slug`.
5. **Fotos.** Hoje ficam em IndexedDB. Precisam de storage com URL assinada, autorização de imagem por foto e vínculo `sessaoId` + `tipo` (antes/depois).
6. **Regras de segurança.** Cliente só lê o que é dela; esteticista só lê a própria clínica; confirmação de pagamento só pela esteticista.
7. **Agendador de avisos.** Cloud Function/cron reproduzindo `runReminders()` (hoje roda a cada 60 s com o app aberto) e entrega por push.
8. **Definir o que o modelo ainda não cobre:** pacotes de sessões (hoje só um texto "sessão 2 de 4"), equipe/várias profissionais por clínica, recibo/nota, cobrança online (Pix com baixa automática), e-mails transacionais.

## 3. Entregáveis desta etapa

- Diagrama das coleções/tabelas e regras de acesso.
- Contrato de cada serviço (`*.service.ts`) com as chamadas ao banco, mantendo as assinaturas atuais.
- Plano de migração dos dados locais de teste (descartar) e do `resetDemoData`.
- Lista de índices e custos estimados.

## 4. Depois: auditoria e otimização (não agora)

- Revisar duplicação (listas de procedimentos, formatadores de moeda/data), tamanho de arquivos grandes e tipos.
- Medir bundle e carregamento; dividir o que for pesado (mapa facial, editor).
- Acessibilidade e testes automatizados dos fluxos principais.

## 5. Lembrete para a etapa seguinte

**Instalar na tela inicial (PWA):** manifesto com nome "EstetBoost." e ícone EB, service worker, ícones 192/512 e maskable, tela de abertura, botão "Instalar app" (Android) e instrução para iOS (Compartilhar → Adicionar à Tela de Início).
