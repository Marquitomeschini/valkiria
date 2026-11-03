// Valkiria service worker: downloads the videos and photos the page asks for (chrome.downloads is
// not available to content scripts). Files go to Downloads/Valkiria/<folder>/.
//
// Two ways to get a file:
//  - direct: chrome.downloads straight to the CDN URL (Instagram, X, Facebook, TikTok photos).
//  - fetch:  a hidden offscreen page fetches the file with the browser's cookies and a
//            "Referer: https://www.tiktok.com/" header (added by the session rule below), then
//            chrome.downloads saves the resulting blob. TikTok videos need this: their CDN rejects
//            requests without both. Any direct download that fails is retried this way.
"use strict";

const CONCURRENCY = 3;
const RETRY_ERRORS = /^(SERVER_FORBIDDEN|SERVER_UNAUTHORIZED|SERVER_BAD_CONTENT|SERVER_FAILED|SERVER_NO_RANGE|NETWORK_FAILED|NETWORK_SERVER_DOWN|NETWORK_INVALID_REQUEST)$/;
const TIKTOK_MEDIA_DOMAINS = ["tiktok.com", "tiktokcdn.com", "tiktokcdn-us.com", "tiktokcdn-eu.com", "tiktokv.com", "tiktokv.us", "tiktokv.eu", "ibyteimg.com", "byteoversea.com", "muscdn.com"];

// Only this extension's own requests (no tab) to TikTok's servers get the Referer.
const rulesReady = chrome.declarativeNetRequest
  .updateSessionRules({
    removeRuleIds: [1],
    addRules: [
      {
        id: 1,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            { header: "referer", operation: "set", value: "https://www.tiktok.com/" },
            { header: "origin", operation: "remove" },
          ],
        },
        condition: { requestDomains: TIKTOK_MEDIA_DOMAINS, initiatorDomains: [chrome.runtime.id], tabIds: [chrome.tabs.TAB_ID_NONE] },
      },
    ],
  })
  .catch((e) => console.warn("Valkiria: could not add the Referer rule", e));

const jobs = new Map(); // jobId -> job
const byDownloadId = new Map(); // chrome download id -> { job, file, blobUrl }
let nextJob = 1;

// ---------- offscreen document ----------
// The document exists before its script listens, so wait for its "ready" message after creating it.
let offscreenCreating = null;
let offscreenReady = null;
let markOffscreenReady = () => {};
async function ensureOffscreen() {
  if (!offscreenCreating && (await chrome.offscreen.hasDocument())) {
    if (offscreenReady) await offscreenReady;
    return;
  }
  if (!offscreenCreating) {
    offscreenReady = new Promise((resolve) => {
      markOffscreenReady = resolve;
      setTimeout(resolve, 3000); // never wait forever; sendToOffscreen retries anyway
    });
    offscreenCreating = chrome.offscreen
      .createDocument({
        url: "src/offscreen/offscreen.html",
        reasons: [chrome.offscreen.Reason.BLOBS],
        justification: "Descargar videos que solo se entregan con la cookie y el Referer del sitio.",
      })
      .catch((e) => {
        if (!/single offscreen/i.test(String(e && e.message))) throw e; // already open elsewhere: fine
      })
      .finally(() => (offscreenCreating = null));
  }
  await offscreenCreating;
  await offscreenReady;
}
async function sendToOffscreen(msg) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await chrome.runtime.sendMessage(Object.assign({ target: "offscreen" }, msg));
    } catch (e) {
      if (attempt >= 8 || !/Receiving end does not exist/i.test(String(e && e.message))) throw e;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}
async function closeOffscreenIfIdle() {
  for (const job of jobs.values()) if (job.active > 0 || job.next < job.files.length) return;
  try {
    if (await chrome.offscreen.hasDocument()) await chrome.offscreen.closeDocument();
  } catch (_) {}
}

// ---------- jobs ----------
function report(job) {
  const finished = job.done + job.failed >= job.files.length || (job.cancelled && job.active === 0);
  chrome.tabs
    .sendMessage(job.tabId, {
      type: "fo:download-progress",
      jobId: job.id,
      total: job.files.length,
      done: job.done,
      failed: job.failed,
      cancelled: job.cancelled,
      finished,
    })
    .catch(() => {});
  if (finished) {
    jobs.delete(job.id);
    closeOffscreenIfIdle();
  }
}

function finish(job, ok) {
  job.active--;
  if (ok) job.done++;
  else job.failed++;
  report(job);
  pump(job);
}

function startDirect(job, file) {
  chrome.downloads.download({ url: file.url, filename: file.filename, conflictAction: "uniquify", saveAs: false }, (id) => {
    if (chrome.runtime.lastError || id == null) return startFetch(job, file);
    byDownloadId.set(id, { job, file, blobUrl: null });
  });
}

async function startFetch(job, file) {
  if (job.cancelled) return finish(job, false);
  file.fetched = true;
  try {
    await rulesReady;
    await ensureOffscreen();
    const res = await sendToOffscreen({ type: "fo:fetch-blob", urls: [file.url, ...(file.alts || [])] });
    if (!res || !res.ok) return finish(job, false);
    if (job.cancelled) {
      sendToOffscreen({ type: "fo:revoke", blobUrl: res.blobUrl }).catch(() => {});
      return finish(job, false);
    }
    chrome.downloads.download({ url: res.blobUrl, filename: file.filename, conflictAction: "uniquify", saveAs: false }, (id) => {
      if (chrome.runtime.lastError || id == null) return finish(job, false);
      byDownloadId.set(id, { job, file, blobUrl: res.blobUrl });
    });
  } catch (_) {
    finish(job, false);
  }
}

function pump(job) {
  while (!job.cancelled && job.active < CONCURRENCY && job.next < job.files.length) {
    const file = job.files[job.next++];
    job.active++;
    if (file.via === "fetch") startFetch(job, file);
    else startDirect(job, file);
  }
  if (job.cancelled && job.active === 0) report(job);
}

chrome.downloads.onChanged.addListener((delta) => {
  const entry = byDownloadId.get(delta.id);
  if (!entry || !delta.state) return;
  const state = delta.state.current;
  if (state !== "complete" && state !== "interrupted") return;
  byDownloadId.delete(delta.id);
  const { job, file, blobUrl } = entry;
  if (blobUrl) sendToOffscreen({ type: "fo:revoke", blobUrl }).catch(() => {});
  if (state === "interrupted" && !file.fetched && !job.cancelled) {
    // The direct download was refused: retry through the offscreen page (cookies + Referer).
    chrome.downloads.search({ id: delta.id }, (items) => {
      const err = items && items[0] && items[0].error;
      if (!err || RETRY_ERRORS.test(err)) {
        chrome.downloads.erase({ id: delta.id }).catch(() => {});
        startFetch(job, file);
      } else finish(job, false);
    });
    return;
  }
  finish(job, state === "complete");
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "fo:offscreen-ready") return markOffscreenReady();
  if (msg && msg.type === "fo:apply-update" && !sender.tab) return void checkForUpdate();
  if (msg && msg.type === "fo:open-app") {
    const tab = /^[a-z]+$/.test(msg.tab || "") ? "#" + msg.tab : "";
    chrome.tabs.create({ url: chrome.runtime.getURL("src/app/app.html" + tab) });
    return;
  }
  if (!msg || !sender.tab) return; // other messages from the offscreen page (pings) only keep us awake
  if (msg.type === "fo:download") {
    const isHttps = (u) => typeof u === "string" && /^https:\/\//.test(u);
    const files = (Array.isArray(msg.files) ? msg.files : [])
      .filter((f) => f && isHttps(f.url) && typeof f.filename === "string" && !f.filename.includes(".."))
      .map((f) => ({ url: f.url, filename: f.filename, alts: (Array.isArray(f.alts) ? f.alts : []).filter(isHttps).slice(0, 6), via: f.via === "fetch" ? "fetch" : "direct" }));
    const job = { id: nextJob++, tabId: sender.tab.id, files, next: 0, active: 0, done: 0, failed: 0, cancelled: false };
    jobs.set(job.id, job);
    sendResponse({ ok: true, jobId: job.id, total: files.length });
    pump(job);
    report(job);
  } else if (msg.type === "fo:download-cancel") {
    const job = jobs.get(msg.jobId);
    if (job) {
      job.cancelled = true;
      for (const [id, e] of byDownloadId) if (e.job === job) chrome.downloads.cancel(id);
      report(job);
    }
    sendResponse({ ok: !!job });
  }
});

// ---------- self-update ----------
// When the folder on disk gets a new version (synced from GitHub by the scheduled task, or copied
// by hand), reload with it, so nobody has to press "reload" in chrome://extensions.
async function diskVersion() {
  const r = await fetch(chrome.runtime.getURL("manifest.json"), { cache: "no-store" });
  return (await r.json()).version;
}
async function checkForUpdate() {
  try {
    if (jobs.size) return false; // don't interrupt downloads; try again next minute
    const running = chrome.runtime.getManifest().version;
    if ((await diskVersion()) === running) return false;
    await new Promise((r) => setTimeout(r, 5000)); // let the sync finish writing every file
    const next = await diskVersion();
    if (next === running || jobs.size) return false;
    await chrome.storage.local.set({ fo_updated: { from: running, to: next, at: Date.now() } });
    chrome.runtime.reload();
    return true;
  } catch (_) {
    return false; // e.g. manifest.json half-written: next minute
  }
}
self.valkiriaCheckForUpdate = checkForUpdate; // used by the tests
chrome.alarms.create("fo-update-check", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "fo-update-check") checkForUpdate();
});
checkForUpdate();

// After an update, mark the icon until the popup is opened.
chrome.storage.local.get("fo_updated", (res) => {
  if (res && res.fo_updated && !res.fo_updated.seen) {
    chrome.action.setBadgeText({ text: "NEW" });
    chrome.action.setBadgeBackgroundColor({ color: "#c9a24a" });
  }
});
