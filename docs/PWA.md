# O app instalado (PWA)

O EstetBoost. é um **PWA**: instalado na tela inicial, abre em tela cheia com o ícone **EB.**, sem barra do navegador, funciona sem internet e recebe avisos com o app fechado.

## O que já está pronto

| Peça                 | Arquivo                                               | Para quê                                                                                                                                     |
| -------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Manifesto            | `public/manifest.webmanifest`                         | Nome "EstetBoost.", ícones, cores, tela cheia, atalhos (Hoje, Agenda, Novo atendimento)                                                      |
| Ícones               | `public/icons/`                                       | 192, 512, 512 _maskable_ (Android) e 180 _apple-touch_ (iPhone)                                                                              |
| Metatags             | `src/routes/__root.tsx`                               | `viewport-fit=cover`, `theme-color`, modo app do iOS (`apple-mobile-web-app-*`, barra de status preta), fundo escuro desde o primeiro quadro |
| Service worker       | `public/sw.js`                                        | Guarda a "casca" do app e os arquivos para abrir offline; recebe push do Firebase; nunca intercepta Supabase/Firebase                        |
| Instalação           | `src/lib/pwa.ts`, `src/components/eb/install-app.tsx` | Botão "Instalar app" (Android/computador), passo a passo no iPhone, convite discreto no celular (dispensável por 14 dias)                    |
| Comportamento de app | `src/styles.css`                                      | Sem "puxar para atualizar", sem destaque azul ao tocar, sem zoom por duplo toque                                                             |

## Como instalar

- **iPhone/iPad (Safari):** Compartilhar → **Adicionar à Tela de Início** → Adicionar. Abra sempre pelo ícone **EB.** Só assim o push funciona no iOS (16.4 ou mais novo).
- **Android (Chrome):** menu ⋮ → **Instalar app** (ou o botão "Instalar app" em Configurações/Perfil).
- **Computador (Chrome/Edge):** ícone de instalar na barra de endereço, ou o botão em Configurações.

## Atualizações

A cada abertura online o app busca a versão nova (as páginas são "rede primeiro"; os arquivos têm nome único por versão). Quem estiver offline continua na versão guardada até reconectar.

## Limites conhecidos

- iOS: sem `beforeinstallprompt` (por isso o passo a passo); push só com o app instalado.
- iOS mostra uma tela escura rápida ao abrir antes da abertura do app; a abertura ("EstetBoost.") cobre o resto. Imagens de abertura nativas por modelo de iPhone (`apple-touch-startup-image`) podem ser adicionadas depois.
- Loja de aplicativos: o PWA não está na App Store/Play Store. Se um dia for necessário, dá para empacotar (Capacitor ou TWA) sem refazer o app.

## Teste de aceitação

1. Instalar pelo celular e abrir pelo ícone: tela cheia, sem barra do navegador, abertura "EstetBoost.", entra direto no app.
2. Ativar o modo avião: o app abre, mostra os dados e a faixa "Sem internet".
3. Cadastrar algo no modo avião, fechar o app, reabrir, desligar o modo avião: a alteração chega ao servidor sozinha.
4. Com o app fechado, gerar um aviso (por exemplo `select app.run_reminders();`): chega o push (ver PUSH-PASSO-A-PASSO.md).
