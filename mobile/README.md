# Leaf mobile

App iOS e Android do Leaf. É uma WebView de `leaf.arvore.com.br` num shell Expo, no mesmo molde do app Árvore (`mobiarvorev3`): o site roda como está, e o app cuida só do que a web não faz no celular.

## O que o shell faz

- **Login pelo navegador do sistema.** O SSO da Árvore passa pelo Google, e o Google recusa WebViews. A tela de login nativa abre `ASWebAuthenticationSession` (iOS) ou Custom Tabs (Android) no fluxo de `signIn.social` do Leaf; o Leaf devolve a sessão em `app.leaf://?cookie=…` (plugin Expo do better-auth) e o app guarda no SecureStore.
- **Entrada da WebView por token de uso único.** A WebView tem o próprio pote de cookies, então o app pede ao Leaf um token de uso único (`GET /api/auth/one-time-token/generate`, com a sessão do SecureStore) e abre a WebView em `GET /api/mobile/enter?token=…`. Essa rota troca o token pelo cookie de sessão, `HttpOnly` e `Secure`, e redireciona para `/`. O token vale 3 minutos e só uma vez.
- **Sessão que cai.** Se a WebView chegar em `/login` (por navegação de documento ou pelo router do Next, como faz o logout do menu do usuário), ou a entrada responder 401, o app entende que a sessão acabou, encerra a sessão no servidor e mostra a tela de login nativa.
- **Domínio único.** Navegação de topo para fora de `leaf.arvore.com.br` abre no navegador do sistema. No iOS, `WKAppBoundDomains` prende a WebView ao domínio e libera o service worker do Leaf (offline).
- **Botão voltar do Android**, safe area, barra de navegação no tema do sistema, skeleton até a primeira pintura e tela de sem conexão com tentativa automática.

## Rodando

Precisa de development build: o esquema `app.leaf` e o `expo-secure-store` não funcionam no Expo Go.

```bash
pnpm install
pnpm build:dev          # eas build --profile development (uma vez por aparelho)
pnpm start              # metro
```

Para apontar o app a um Leaf local, crie `.env` a partir de `.env.example` com `EXPO_PUBLIC_LEAF_URL=http://<ip-da-máquina>:3000`. Em desenvolvimento o Leaf já aceita o esquema `exp://` nos `trustedOrigins`.

Antes de abrir PR:

```bash
pnpm typecheck
pnpm lint
pnpm doctor
```

## Estrutura

```
app/_layout.tsx            SafeArea + SessionProvider + Stack
app/index.tsx              a WebView do Leaf
app/login.tsx              tela de login nativa
app/no-connection.tsx      sem conexão
src/contexts/SessionContext.tsx   restaura, entra, sai
src/lib/auth-client.ts     better-auth + plugin Expo + token de uso único
src/lib/session-handoff.ts pede o token e monta a URL de entrada da WebView
src/constants/config.ts    URL do Leaf, tema
```

## O que fica fora por enquanto

Push, widgets, Universal Links / App Links e publicação nas lojas. O projeto EAS (`extra.eas.projectId`) ainda não foi criado.
