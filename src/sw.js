import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { clientsClaim } from "workbox-core";
self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));
self.addEventListener("push", (event) => {
  let id = "reminder";
  try {
    const data = event.data?.json();
    if (typeof data?.id === "string") id = data.id.slice(0, 100);
  } catch {
    /* Always show a visible, private notification. */
  }
  event.waitUntil(
    self.registration.showNotification("Better Every Day", {
      body: "It is time for a planned reminder. Open your tracker to check in.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: `bed-${id}`,
      data: { url: "/" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const app = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (app) return app.focus();
      return self.clients.openWindow("/");
    })(),
  );
});
