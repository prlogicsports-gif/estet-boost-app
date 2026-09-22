# EstetBoost — fundação e acesso

## Escopo desta etapa

- Recriar fielmente os tokens visuais e tipográficos dos protótipos, incluindo Geist, Geist Mono, raios, sombras, estados, áreas seguras e redução de movimento.
- Montar o `AppShell` responsivo:
  - mobile: dock glass flutuante com Hoje, Agenda, Clientes, Gestão e Mais;
  - desktop: sidebar glass com Hoje, Agenda, Clientes, Gestão, Notificações, Credenciais e Configurações;
  - Mais reúne Notificações, Credenciais e Configurações no mobile.
- Implementar a splash animada `EB.` → `EstetBoost.` com duração aproximada de 2,5 segundos.
- Implementar a tela de acesso com o carrossel de fotos dos protótipos e painel glass.
- Implementar os fluxos locais, sem backend:
  - Entrar;
  - esqueci minha senha;
  - Criar conta em 2 passos;
  - cadastro de cliente por `?p=<slug>` ou `?convite=<código>`.
- Manter dados e respostas mockadas atrás de serviços substituíveis posteriormente.
- Criar somente páginas-base vazias para os destinos da navegação; as telas funcionais seguintes ficam fora desta etapa.

## Estrutura proposta

```text
src/
├── assets/
│   ├── fonts/
│   └── images/auth/
├── components/
│   ├── brand/
│   │   └── brand-mark.tsx
│   ├── auth/
│   │   ├── auth-carousel.tsx
│   │   ├── login-form.tsx
│   │   ├── forgot-password-form.tsx
│   │   ├── signup-flow.tsx
│   │   └── client-invite-form.tsx
│   ├── shell/
│   │   ├── app-shell.tsx
│   │   ├── desktop-sidebar.tsx
│   │   ├── mobile-dock.tsx
│   │   └── more-menu.tsx
│   ├── splash/
│   │   └── splash-screen.tsx
│   └── ui/
│       ├── button.tsx
│       ├── input.tsx
│       ├── tabs.tsx
│       ├── dialog.tsx
│       └── popover.tsx
├── data/
│   └── mock-auth.ts
├── lib/
│   ├── auth.types.ts
│   ├── invite.ts
│   └── utils.ts
├── services/
│   └── auth.service.ts
├── routes/
│   ├── __root.tsx
│   ├── index.tsx
│   ├── login.tsx
│   ├── hoje.tsx
│   ├── agenda.tsx
│   ├── clientes.tsx
│   ├── gestao.tsx
│   ├── notificacoes.tsx
│   ├── credenciais.tsx
│   └── configuracoes.tsx
└── styles.css
```

## Observação técnica

O projeto atual usa TanStack Router, equivalente ao roteamento React solicitado e obrigatório nesta base. A navegação será implementada nele, sem introduzir um segundo roteador.

## Validação

- Conferir splash, login e cadastro em viewport mobile e desktop.
- Testar abas, carrossel, recuperação de senha, duas etapas do cadastro, convite por slug/código, dock, sidebar e menu Mais.
- Verificar textos, contraste, toque mínimo de 44 px, áreas seguras e comportamento com movimento reduzido.
