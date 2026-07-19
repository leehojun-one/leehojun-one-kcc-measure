/* KCC 현장 실측 — 공유 수신용 서비스워커
   카카오톡 등에서 실측파일(.json)을 '공유'하면 이 워커가 받아서
   앱(index.html)으로 넘겨줍니다. 오프라인 캐시는 하지 않습니다. */

const SHARE_CACHE = 'kcc-shared-v1';

self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 안드로이드 공유 시트에서 넘어온 파일 (POST ./share)
  if (event.request.method === 'POST' && url.pathname.endsWith('/share')) {
    event.respondWith(handleShare(event.request));
    return;
  }

  // 앱이 공유받은 파일을 읽어가는 통로
  if (event.request.method === 'GET' && url.pathname.endsWith('/shared-file')) {
    event.respondWith(readShared());
    return;
  }
  // 그 외 요청은 그대로 통과 (캐시 없음)
});

async function handleShare(request) {
  let saved = false;
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (file && typeof file.text === 'function') {
      const text = await file.text();
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(
        new Request('shared-file', { method: 'GET' }),
        new Response(text, { headers: { 'Content-Type': 'application/json' } })
      );
      saved = true;
    }
  } catch (e) {
    saved = false;
  }
  const target = new URL('./index.html', self.registration.scope);
  target.searchParams.set('shared', saved ? '1' : 'err');
  return Response.redirect(target.href, 303);
}

async function readShared() {
  const cache = await caches.open(SHARE_CACHE);
  const res = await cache.match(new Request('shared-file', { method: 'GET' }));
  if (!res) return new Response('', { status: 404 });
  await cache.delete(new Request('shared-file', { method: 'GET' })); // 한 번만 사용
  return res;
}
