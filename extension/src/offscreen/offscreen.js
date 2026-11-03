// Hidden extension page (chrome.offscreen) that fetches files which only download with the site's
// cookie and Referer (TikTok videos) and turns them into blob: URLs that chrome.downloads can save.
"use strict";

const MEDIA_TYPE = /^(video|image|audio)\/|octet-stream|binary/i;

async function fetchFirst(urls) {
  let last = "sin URL";
  for (const url of urls) {
    try {
      const r = await fetch(url, { credentials: "include", cache: "no-store" });
      const type = r.headers.get("content-type") || "";
      if (!r.ok) {
        last = "HTTP " + r.status;
        continue;
      }
      if (type && !MEDIA_TYPE.test(type)) {
        last = "respuesta que no es un archivo (" + type + ")";
        continue;
      }
      const blob = await r.blob();
      if (!blob.size) {
        last = "archivo vacío";
        continue;
      }
      return { ok: true, blobUrl: URL.createObjectURL(blob), size: blob.size, url };
    } catch (e) {
      last = e && e.message ? e.message : "error de red";
    }
  }
  return { ok: false, error: last };
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (!msg || msg.target !== "offscreen") return;
  if (msg.type === "fo:fetch-blob") {
    // Keep the service worker awake during long fetches.
    const ping = setInterval(() => chrome.runtime.sendMessage({ type: "fo:ping" }).catch(() => {}), 10000);
    fetchFirst(msg.urls || []).then((res) => {
      clearInterval(ping);
      reply(res);
    });
    return true;
  }
  if (msg.type === "fo:revoke") {
    try {
      URL.revokeObjectURL(msg.blobUrl);
    } catch (_) {}
    reply({ ok: true });
  }
});

// Tell the service worker the listener above is in place.
chrome.runtime.sendMessage({ type: "fo:offscreen-ready" }).catch(() => {});
