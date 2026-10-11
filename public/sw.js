/*
 * Service worker do EstetBoost.: faz o app abrir e funcionar sem internet (guarda a "casca" do app e os arquivos)
 * e recebe o push do Firebase com o app fechado. Os DADOS não passam por aqui: ficam no IndexedDB do app
 * (cópia + fila de alterações) e a comunicação com o Supabase nunca é interceptada.
 */
const PAGES = "eb-pages-v2";
const ASSETS = "eb-assets-v2";
const KEEP = [PAGES, ASSETS];
const SHELL_ROUTES = [
  "/",
  "/hoje",
  "/agenda",
  "/clientes",
  "/gestao",
  "/notificacoes",
  "/configuracoes",
  "/credenciais",
  "/catalogo",
  "/atendimento/novo",
  "/cliente",
  "/cliente/agenda",
  "/cliente/evolucao",
  "/cliente/perfil",
];
const STATIC = [
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/badge-96.png",
  "/icons/apple-touch-icon.png",
];

async function cacheShell() {
  const pages = await caches.open(PAGES);
  const assets = await caches.open(ASSETS);
  const found = new Set(STATIC);
  await Promise.all(
    SHELL_ROUTES.map(async (path) => {
      try {
        const response = await fetch(path, { cache: "reload" });
        if (!response.ok) return;
        await pages.put(path, response.clone());
        // os arquivos com nome único (hash) que a página usa
        const html = await response.text();
        for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) found.add(match[1]);
      } catch {
        /* sem internet na instalação: o resto é guardado conforme o uso */
      }
    }),
  );
  await Promise.all([...found].map((url) => assets.add(url).catch(() => {})));
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(cacheShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith("eb-") && !KEEP.includes(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

const offlinePage = () =>
  new Response(
    '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EstetBoost.</title><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#241c20;color:#f7f2ef;font-family:system-ui,sans-serif;text-align:center;padding:24px"><div><h1 style="font-weight:500">Sem internet</h1><p style="opacity:.7">Abra o app uma vez com internet para ele funcionar offline. Depois é só voltar.</p></div></body></html>',
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

async function navigate(request) {
  const url = new URL(request.url);
  const pages = await caches.open(PAGES);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("lento")), 4500)),
    ]);
    if (response.ok && !response.redirected) pages.put(url.pathname, response.clone());
    return response;
  } catch {
    // sem internet: a página guardada; para endereços novos, a do "pai" (/clientes/abc → /clientes) ou a inicial
    const parts = url.pathname.split("/").filter(Boolean);
    while (parts.length) {
      const hit = await pages.match("/" + parts.join("/"));
      if (hit) return hit;
      parts.pop();
    }
    return (await pages.match("/")) || offlinePage();
  }
}

async function cacheFirst(request) {
  const assets = await caches.open(ASSETS);
  const hit = await assets.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) assets.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const assets = await caches.open(ASSETS);
  const hit = await assets.match(request);
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok) assets.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return hit || (await fresh) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, Firebase etc.: nunca interceptados
  if (url.pathname.startsWith("/_server") || url.pathname.startsWith("/api")) return;
  if (request.mode === "navigate") return void event.respondWith(navigate(request));
  if (url.pathname.startsWith("/assets/")) return void event.respondWith(cacheFirst(request));
  if (["script", "style", "font", "image", "manifest"].includes(request.destination))
    return void event.respondWith(staleWhileRevalidate(request));
});

// ---------------------------------------------------------------- push (Firebase Cloud Messaging)
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const data = payload.data || payload.notification || payload || {};
  const title = data.title || "EstetBoost.";
  const options = {
    body: data.body || "",
    tag: data.tag || undefined,
    // ícone colorido (aparece dentro do aviso) e ícone pequeno branco da barra de status do Android
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    vibrate: [160, 80, 160],
    timestamp: Date.now(),
    data: { href: data.href || "/" },
  };
  const unread = Number(data.unread);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      // com o app aberto e visível, o próprio app mostra o banner por dentro: não duplica
      const visible = windows.some((client) => client.visibilityState === "visible");
      if (visible) return;
      // número no ícone do app (Android e iPhone com o app instalado)
      try {
        if (Number.isFinite(unread) && unread > 0 && self.navigator.setAppBadge)
          await self.navigator.setAppBadge(unread);
      } catch {
        /* sem suporte */
      }
      await self.registration.showNotification(title, options);
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // app já aberto: foca e pede para ele navegar sem recarregar (evita tela em branco e perda de estado)
      for (const client of windows) {
        if ("focus" in client) {
          client.postMessage({ type: "eb:open", href });
          return client.focus();
        }
      }
      return self.clients.openWindow(href);
    }),
  );
});
