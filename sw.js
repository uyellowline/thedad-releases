// Minimal app-shell service worker. Caches the navigation shell and same-origin static assets
// so the app boots offline. Dynamic data lives in IndexedDB and is independent of the cache.

// Версию подставляет сборка (см. плагин sw-version в vite.config.ts). В dev
// остаётся плейсхолдер — там service worker не регистрируется.
const CACHE = 'thedad-shell-1.2.1-mwmc3k3m';
// Только то, что реально существует по этим путям в проде. Манифест сюда не
// входит: Vite отдаёт его по хешированному имени, и addAll() на 404 отклоняет
// ВЕСЬ precache — приложение молча остаётся без офлайн-оболочки.
// Build injects all code/font/WASM chunks, including lazy routes. Media is on demand.
const ASSETS = ["/assets/activityAction-ZMQf7aKQ.js","/assets/ActivityWidget-DIYNC9jH.js","/assets/AiGenerateModal-qSJ78eJU.js","/assets/aiProvider-BnHPszMY.js","/assets/Analytics-CX5uSgKk.js","/assets/Awards-DegG5omi.js","/assets/badge-BPBDBbv8.js","/assets/Calendar-BCdii_EO.js","/assets/CalendarWidget-DHVP8HzE.js","/assets/CaloriesWidget-C_QXwOwK.js","/assets/charts-BF9f57oJ.js","/assets/cmdk-UNTEhrDb.js","/assets/CoachPanel-B3fWv6om.js","/assets/cryptoExport-C_4k0mFY.js","/assets/date-BO0hvMKo.js","/assets/dnd-CjlGcrQz.js","/assets/driveBackup-Do2W4JGR.js","/assets/EChartsImpl-CuCsXg-o.js","/assets/FocusMode-rZp9voGd.js","/assets/forecastSummary-A71WxCMf.js","/assets/Goals-Cd-MrgG0.js","/assets/grid-C9-ySRfk.css","/assets/grid-DxFF4iBl.js","/assets/Habits-DIbe3Tff.js","/assets/Health-WNO_7GfS.js","/assets/HealthWidget-zU_4sQjE.js","/assets/History-EfYt9nlT.js","/assets/icons-8wOHkuiu.js","/assets/imageCompress-CeE06fiX.js","/assets/index-BVp8ATSj.js","/assets/index-DDaqgH7m.css","/assets/index-XF5i2PdY.js","/assets/inter-cyrillic-ext-wght-normal-BOeWTOD4.woff2","/assets/inter-cyrillic-wght-normal-DqGufNeO.woff2","/assets/inter-greek-ext-wght-normal-DlzME5K_.woff2","/assets/inter-greek-wght-normal-CkhJZR-_.woff2","/assets/inter-latin-ext-wght-normal-DO1Apj_S.woff2","/assets/inter-latin-wght-normal-Dx4kXJAl.woff2","/assets/inter-vietnamese-wght-normal-CBcvBZtf.woff2","/assets/Landing-CYVLOETp.js","/assets/MarketplaceModal-smM6cIBK.js","/assets/mood-icon-ByQsWaj_.js","/assets/paceAlert-BIoEahWp.js","/assets/page-container-CM9eg5UE.js","/assets/PlaceMapPicker-CFxc_oaa.js","/assets/Plan-X5MYdJzz.js","/assets/pomodoroState-DMbMX0m6.js","/assets/profile-DY5Qad1u.js","/assets/Profile-DYetBW2A.js","/assets/programAdapt-DxEb3IYn.js","/assets/ProgramRunner-CH-AMCWB.js","/assets/ProgramWidget-Bd8XRyFg.js","/assets/radix-MLPB-lPV.js","/assets/Reflection-BVdKITKW.js","/assets/Settings-CIq5GEcG.js","/assets/SoundscapeWidget-4MZQXSiX.js","/assets/sparkline-B852te8x.js","/assets/sql-wasm-UFUCzYNW.wasm","/assets/sqlite-Djj0Ftbl.js","/assets/sync-DxWdI01U.js","/assets/Tasks-BJTM-nuR.js","/assets/Templates-Cp11R1ls.js","/assets/TimeAllocation-_p_Z9-SN.js","/assets/UpcomingEvents-DrMb-uYE.js","/assets/vendor-BK0wQa1K.js","/assets/vendor-Dgihpmma.css","/assets/weeklyReview-8Ul69dOw.js","/assets/WeeklyReview-DegLg4Ak.js","/assets/WeekProgressChart-D0HKguXN.js","/assets/WidgetPicker-Cadb-wIv.js","/assets/WorkoutHub-CCEP1BQX.js","/assets/WorkoutWidget-DDntpiKo.js"];
const SHELL = ['/', '/index.html', '/theme-init.js', ...ASSETS];

self.addEventListener('install', (e) => {
  // A partial download must not replace a working offline version.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  // Без skipWaiting: новый воркер ждёт, пока пользователь сам согласится
  // обновиться — иначе ассеты подменяются под открытым приложением.
});

// Кнопка «обновить» в интерфейсе просит ожидающий воркер активироваться.
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('thedad-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // SPA navigation: network-first, fallback to cached index.html.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('/index.html').then((r) => r || Response.error()))
    );
    return;
  }

  // Stale-while-revalidate for assets.
  e.respondWith(
    // Same-origin build assets are identical across Origin headers. Module loads
    // send Origin while install-time addAll does not; Vary: Origin must not hide
    // the precached response when the browser goes offline.
    caches.open(CACHE).then((cache) => cache.match(req, { ignoreVary: true })).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      }).catch(() => cached || Response.error());
      return cached || fetchPromise;
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => {
    for (const c of cs) if ('focus' in c) return c.focus();
    if (self.clients.openWindow) return self.clients.openWindow('/');
  }));
});
