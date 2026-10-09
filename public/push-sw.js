/*
 * Service worker do push (EstetBoost.). Recebe a mensagem do Firebase Cloud Messaging mesmo com o app fechado
 * e mostra a notificação. Mensagens só de dados: { title, body, href, tag }.
 * Se o app já está aberto e visível, não mostra (o próprio app avisa por dentro, sem duplicar).
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: { href: data.href || "/" },
  };
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const visible = windows.some((client) => client.visibilityState === "visible");
      return visible ? undefined : self.registration.showNotification(title, options);
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) {
          client.navigate(href).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(href);
    }),
  );
});
