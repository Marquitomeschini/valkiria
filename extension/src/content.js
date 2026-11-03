(function (root) {
  "use strict";
  const FO = root.FO;
  if (!FO || root.__valkiriaContent) return;
  root.__valkiriaContent = true;

  const platform = FO.platformForHost(location.hostname);
  if (!platform) return;

  const store = new FO.Store();
  let lastCtx = FO.ctxKey(platform, location.href) || "home";

  function getCtx() {
    const k = FO.ctxKey(platform, location.href);
    if (k != null) lastCtx = k;
    return lastCtx;
  }

  // ---- diagnostic: the shape (field names only, no content) of the last responses ----
  const POST_KEYS = ["code", "shortcode", "rest_id", "post_id", "playCount", "aweme_id"];
  const diag = [];
  function shapeOf(o, depth) {
    if (Array.isArray(o)) return o.length ? [shapeOf(o[0], depth)] : [];
    if (!o || typeof o !== "object") return typeof o;
    if (depth <= 0) return "{…}";
    const out = {};
    for (const k of Object.keys(o).sort().slice(0, 60)) out[k] = shapeOf(o[k], depth - 1);
    return out;
  }
  function postSamples(doc) {
    const found = FO.util.deepCollect(doc, (n) => (POST_KEYS.some((k) => k in n && typeof n[k] !== "object") ? shapeOf(n, 2) : undefined), null, 2);
    return found;
  }
  // Page paths without account names or ids: /ana_e36/reels/ -> /<perfil>/reels/
  function pathPattern(p) {
    return (
      "/" +
      p
        .split("/")
        .filter(Boolean)
        .map((seg, i) => (/^\d+$/.test(seg) ? "<id>" : i === 0 && (FO.profileOwner(platform, seg.toLowerCase()) || seg.startsWith("@")) ? "<perfil>" : i > 0 && !/^[a-z_]{2,20}$/.test(seg) ? "<x>" : seg))
        .join("/") +
      (p.endsWith("/") && p !== "/" ? "/" : "")
    );
  }
  function ctxKind(ctx) {
    if (FO.profileOwner(platform, ctx) || ctx.startsWith("@")) return "perfil";
    if (ctx.endsWith("/tagged")) return "perfil (etiquetadas)";
    if (ctx.startsWith("search:")) return "búsqueda";
    if (ctx.startsWith("profile:")) return "perfil";
    return ctx.split("/")[0];
  }
  function record(url, name, text, docs, own, others, partials) {
    let path = "(html de la página)";
    if (name !== "html") {
      try {
        path = pathPattern(new URL(url).pathname);
      } catch (_) {}
    }
    diag.push({
      t: new Date().toISOString().slice(11, 19),
      path,
      name,
      bytes: text.length,
      docs: docs.length,
      own,
      others,
      partials,
      topKeys: docs[0] && typeof docs[0] === "object" ? shapeOf(docs[0], 3) : null,
      samples: own + others === 0 ? docs.slice(0, 2).flatMap(postSamples) : [],
    });
    if (diag.length > 40) diag.shift();
  }

  function ingest(text, url, name) {
    const docs = FO.util.parsePayload(text);
    const ctx = getCtx();
    let own = 0;
    let others = 0;
    let partials = 0;
    for (const doc of docs) {
      const r = FO.extract(platform, doc);
      // On a profile, posts by other accounts (recommendations loaded in the background) are kept apart.
      const mine = [];
      const theirs = [];
      for (const it of r.items) (FO.belongsTo(it, platform, ctx) ? mine : theirs).push(it);
      if (mine.length || r.partials.length) store.add(mine, r.partials, ctx);
      if (theirs.length) store.add(theirs, [], "otros:" + ctx);
      own += mine.length;
      others += theirs.length;
      partials += r.partials.length;
    }
    if (url) record(url, name || null, text, docs, own, others, partials);
  }

  // ---- data from the page hook (src/hook.js, MAIN world) ----
  document.addEventListener("valkiria:data", (e) => {
    try {
      const msg = JSON.parse(e.detail);
      if (msg && typeof msg.text === "string") ingest(msg.text, msg.url, msg.name);
    } catch (_) {}
  });
  const sayReady = () => document.dispatchEvent(new CustomEvent("valkiria:ready"));
  document.addEventListener("valkiria:hello", sayReady);
  sayReady();

  // ---- data embedded in the HTML on first load (server-rendered JSON) ----
  const scanned = new WeakSet();
  function scanEmbedded() {
    const nodes = document.querySelectorAll('script[type="application/json"], script#__UNIVERSAL_DATA_FOR_REHYDRATION__, script#SIGI_STATE');
    for (const s of nodes) {
      if (scanned.has(s)) continue;
      scanned.add(s);
      const t = s.textContent;
      if (!t || t.length > 15 * 1024 * 1024) continue;
      if (!/like_count|playCount|favorite_count|post_id|edge_media|reaction_count|play_count/.test(t)) continue;
      ingest(t, location.href + "#embedded", "html");
    }
  }

  // ---- what the user is looking at ----
  function noun() {
    if (platform === "instagram") return /\/reels\/?/.test(location.pathname) ? "reels" : "publicaciones";
    if (platform === "tiktok") return "videos";
    if (platform === "x") return "posts";
    return "publicaciones";
  }
  function ctxLabel(ctx) {
    if (ctx === "home") return "Inicio";
    if (ctx.startsWith("search:")) return "Búsqueda: " + ctx.slice(7);
    if (ctx.startsWith("profile:")) return "Perfil";
    const tag = /^(?:explore\/tags|tag|hashtag)\/(.+)$/.exec(ctx);
    if (tag) return "#" + tag[1];
    if (ctx.includes("/")) return ctx;
    return ctx.startsWith("@") ? ctx : "@" + ctx;
  }

  // ---- auto-load: scroll so the site requests more posts ----
  function biggestScroller() {
    let best = null;
    let bestArea = 0;
    for (const el of document.querySelectorAll("main, div, section")) {
      if (el.scrollHeight - el.clientHeight < 400) continue;
      const oy = getComputedStyle(el).overflowY;
      if (oy !== "auto" && oy !== "scroll") continue;
      const area = el.clientWidth * el.clientHeight;
      if (area > bestArea) {
        best = el;
        bestArea = area;
      }
    }
    return best;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** True when the newest posts loaded (feed order, skipping the first 3 that may be pinned) are all older than `from`. */
  function tailOlderThan(ctx, from) {
    const list = store.inCtx(ctx).slice(3).filter((i) => i.date != null);
    if (list.length < 3) return false;
    return list.slice(-4).every((i) => i.date < from);
  }
  function oldestTail(ctx) {
    const list = store.inCtx(ctx).slice(3).filter((i) => i.date != null);
    return list.length ? Math.min(...list.slice(-4).map((i) => i.date)) : null;
  }

  const loader = {
    running: false,
    stopRequested: false,
    stop() {
      this.stopRequested = true;
    },
    /** Returns why it stopped: "limit" | "date" | "end" | "stopped" | "nav". */
    async load({ ctx, limit, from, onProgress }) {
      this.running = true;
      this.stopRequested = false;
      const MAX_IDLE = 6;
      let idle = 0;
      let reason = "end";
      const progress = () => {
        const n = store.count(ctx);
        let frac = null;
        if (limit && limit < 5000) frac = n / limit;
        else if (from) {
          const o = oldestTail(ctx);
          if (o != null) frac = (Date.now() - o) / (Date.now() - from);
        }
        onProgress(n, frac);
      };
      try {
        progress();
        while (true) {
          if (this.stopRequested) {
            reason = "stopped";
            break;
          }
          if (getCtx() !== ctx) {
            reason = "nav";
            break;
          }
          const before = store.count(ctx);
          if (limit && before >= limit) {
            reason = "limit";
            break;
          }
          if (from && tailOlderThan(ctx, from)) {
            reason = "date";
            break;
          }
          const sc = document.scrollingElement || document.documentElement;
          const inner = biggestScroller();
          // A small step back up re-triggers "near the bottom" observers on some sites.
          window.scrollBy(0, -300);
          if (inner) inner.scrollTop -= 300;
          await sleep(120);
          window.scrollTo(0, sc.scrollHeight);
          if (inner) inner.scrollTop = inner.scrollHeight;
          // Wait for the next batch (or give up on this round after 2.5 s).
          const t0 = Date.now();
          let grew = false;
          while (Date.now() - t0 < 2500 && !this.stopRequested) {
            await sleep(120);
            if (store.count(ctx) > before) {
              grew = true;
              break;
            }
          }
          if (grew) {
            idle = 0;
            await sleep(300); // let the page add the new rows before scrolling again
          } else {
            idle++;
          }
          progress();
          if (idle >= MAX_IDLE) {
            reason = "end";
            break;
          }
        }
      } finally {
        this.running = false;
      }
      return reason;
    },
  };

  // ---- runs requested from the popup ----
  const DAY = 86400000;
  const PRESETS = { week: 7, month: 30, "3m": 91, "6m": 182, year: 365 };
  const loadState = {}; // ctx -> { end, reachedFrom }
  let pendingSort = null;

  function resolveFilter(f) {
    const out = { limit: null, from: null, to: null };
    if (!f) return out;
    if (f.mode === "posts") out.limit = f.limit ? Number(f.limit) : null;
    else if (f.mode === "date") {
      if (PRESETS[f.preset]) out.from = Date.now() - PRESETS[f.preset] * DAY;
      else if (f.preset === "custom") {
        out.from = f.from ?? null;
        out.to = f.to ?? null;
      }
    }
    return out;
  }

  async function run(msg) {
    if (loader.running) {
      pendingSort = msg.sortKey; // a new sort chosen while loading: use it when loading ends
      return;
    }
    const ctx = getCtx();
    const q = resolveFilter(msg.filter);
    const st = loadState[ctx] || {};
    const have = store.count(ctx);
    const satisfied = st.end || (q.limit && have >= q.limit) || (q.from != null && st.reachedFrom != null && st.reachedFrom <= q.from);
    pendingSort = null;
    if (!satisfied) {
      ui.showLoading();
      const reason = await loader.load({
        ctx,
        limit: q.limit || 5000,
        from: q.from,
        onProgress: (n, frac) => ui.updateLoading(n, frac, noun()),
      });
      ui.hideLoading();
      if (reason === "nav") return;
      if (reason === "end") loadState[ctx] = { end: true };
      else if (reason === "date") loadState[ctx] = Object.assign({}, st, { reachedFrom: Math.min(q.from, st.reachedFrom ?? Infinity) });
    }
    window.scrollTo(0, 0);
    ui.showResults({ ctx, sortKey: pendingSort || msg.sortKey, limit: q.limit, from: q.from, to: q.to, noun: noun() });
  }

  function status() {
    const ctx = getCtx();
    const last = ui.lastParams();
    return {
      ok: true,
      platform,
      ctx,
      label: ctxLabel(ctx),
      count: store.count(ctx),
      running: loader.running,
      noun: noun(),
      hasResults: !!(last && last.ctx === ctx),
    };
  }

  // ---- UI ----
  const ui = FO.createUI({ platform, store, getCtx, onStop: () => loader.stop() });

  function onReady() {
    ui.mount();
    scanEmbedded();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", onReady, { once: true });
  else onReady();
  window.addEventListener("load", scanEmbedded, { once: true });

  // SPA navigation: re-attach if the site wiped the DOM, pick up embedded data, close stale results.
  let lastHref = location.href;
  setInterval(() => {
    if (document.readyState !== "loading") ui.mount();
    if (location.href !== lastHref) {
      lastHref = location.href;
      scanEmbedded();
      const last = ui.lastParams();
      if (ui.isOpen() && last && last.ctx !== getCtx()) ui.hideResults();
    }
  }, 700);

  try {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg || typeof msg.type !== "string") return;
      if (msg.type === "fo:status") sendResponse(status());
      else if (msg.type === "fo:run") {
        run(msg);
        sendResponse({ ok: true });
      } else if (msg.type === "fo:show") {
        const last = ui.lastParams();
        if (last && last.ctx === getCtx()) ui.showResults(last);
        sendResponse({ ok: !!last });
      } else if (msg.type === "fo:diag") {
        const ctx = getCtx();
        sendResponse({
          ok: true,
          text: JSON.stringify(
            {
              valkiria: chrome.runtime.getManifest().version,
              platform,
              page: pathPattern(location.pathname),
              ctx: ctxKind(ctx),
              posts: store.count(ctx),
              otherAccounts: store.count("otros:" + ctx),
              total: store.count(),
              loading: loader.running,
              responses: diag,
            },
            null,
            1
          ),
        });
      } else if (msg.type === "fo:stop") {
        loader.stop();
        sendResponse({ ok: true });
      }
    });
  } catch (_) {}

  // Small debugging handle for the extension's own console (not visible to the page).
  FO.debug = { store, getCtx, platform, loader };
})(typeof globalThis !== "undefined" ? globalThis : this);
