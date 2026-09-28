# EstetBoost: Cuidado Organizado

Vou construir a EstetBoost: um app web mobile-first para esteticistas autônomas e pequenos centros de estética. Frase de posicionamento: "Cuidado organizado. Negócio em evolução."

Anexei dois protótipos HTML funcionais (app da esteticista e app da cliente) e o readme do design system. Eles são a REFERÊNCIA VISUAL E DE FLUXO OBRIGATÓRIA. Não reinvente o visual: recrie fielmente telas, textos, cores, espaçamentos, raios, estados e comportamentos.

Stack: React + TypeScript + Vite + Tailwind + shadcn/ui (Radix) + lucide-react + framer-motion. Rotas com react-router. Nada de backend ainda: dados mockados locais atrás de uma camada de serviço, prontos para trocar por Supabase depois.

Identidade (não alterar):
- Nome sempre "EstetBoost." — "Estet" em Geist Light marfim, "Boost" em Geist Medium nude mineral, ponto final teal.
- Fonte: Geist em tudo; Geist Mono para números (horários, valores, sessões).
- Paleta como tokens CSS em :root e mapeada no tailwind.config: fundo #241C20, superfície #382B31, nude mineral #C3948E, nude areia #DCC8BA, marfim #F7F2EF, branco quente #FFFDFC, texto escuro #2B2729, teal #4FAFAD, teal claro #DCEFED, âmbar #D8A653, coral #C96D6D, texto secundário #857B7F.
- Glass SÓ em: login, navegação (dock/sidebar), bottom sheets, modais, popovers, filtros flutuantes e painel do mapa facial. Fundo rgba(247,242,239,.14), borda rgba(255,255,255,.22), blur 20–24px, raio 24–28px.
- Status nunca só por cor: cor + ícone + palavra (Confirmado teal, Aguardando âmbar, Cancelado coral).
- Toque mínimo 44px, safe-area iOS/Android, prefers-reduced-motion.
- Português do Brasil, segunda pessoa, "cliente" (nunca "paciente"), sem emoji.

Comece por: tokens + fontes, AppShell (dock glass flutuante no mobile, sidebar glass no desktop com Hoje, Agenda, Clientes, Gestão, Notificações, Credenciais, Configurações; no mobile os três últimos ficam em "Mais"), splash animada (EB. → EstetBoost., ~2,5s) e a tela de login com carrossel de fotos + abas Entrar / Criar conta (cadastro em 2 passos) + cadastro de cliente por convite (?p=<slug> ou ?convite=<código>).

Depois me mostre a estrutura de pastas proposta antes de seguir para as outras telas.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1ad3066a-aa22-4447-a7a2-10cc22b3e892).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
