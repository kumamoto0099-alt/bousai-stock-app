const CACHE_VERSION = "v1";
const CACHE_PREFIX = "wagaya-bichiku-";
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

const BASE_PATH = "/bousai-stock-app/";
const APP_PAGE = BASE_PATH + "wagaya_bichiku_check_v6.html";

const PRECACHE_URLS = [
  APP_PAGE,
  BASE_PATH + "manifest.json",
  BASE_PATH + "icon-192.png",
  BASE_PATH + "icon-512.png",
  BASE_PATH + "apple-touch-icon-180.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      await Promise.all(
        PRECACHE_URLS.map(async url => {
          try {
            const response = await fetch(url, {
              cache: "no-store"
            });

            if (response.ok) {
              await cache.put(url, response);
            }
          } catch (error) {
            console.warn(
              "初回キャッシュ失敗:",
              url,
              error
            );
          }
        })
      );

      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();

      await Promise.all(
        names.map(name => {
          if (
            name.startsWith(CACHE_PREFIX) &&
            name !== CACHE_NAME
          ) {
            return caches.delete(name);
          }
        })
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  /*
    HTMLはネットワーク優先。
    オンラインなら最新版を取得して保存。
    オフラインなら保存済み画面を表示。
  */
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(
            request,
            {
              cache: "no-store"
            }
          );

          if (
            networkResponse &&
            networkResponse.ok
          ) {
            const cache =
              await caches.open(CACHE_NAME);

            await cache.put(
              request,
              networkResponse.clone()
            );

            await cache.put(
              APP_PAGE,
              networkResponse.clone()
            );
          }

          return networkResponse;

        } catch (error) {

          const exact =
            await caches.match(request);

          if (exact) {
            return exact;
          }

          const app =
            await caches.match(APP_PAGE);

          if (app) {
            return app;
          }

          return new Response(
            "オフラインです。一度オンライン状態で「わが家の備蓄チェック」を開いてください。",
            {
              status: 503,
              headers: {
                "Content-Type":
                  "text/plain; charset=utf-8"
              }
            }
          );
        }
      })()
    );

    return;
  }

  /*
    manifest・アイコンなどは
    キャッシュを利用しながら最新版へ更新。
  */
  if (url.pathname.startsWith(BASE_PATH)) {
    event.respondWith(
      (async () => {

        const cached =
          await caches.match(request);

        const networkPromise =
          fetch(request, {
            cache: "no-store"
          })
          .then(async response => {

            if (
              response &&
              response.ok
            ) {
              const cache =
                await caches.open(CACHE_NAME);

              await cache.put(
                request,
                response.clone()
              );
            }

            return response;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(networkPromise);
          return cached;
        }

        const network =
          await networkPromise;

        if (network) {
          return network;
        }

        return new Response(
          "",
          {
            status: 503
          }
        );
      })()
    );
   }
});

