(function (root) {
  "use strict";
  const FO = (root.FO = root.FO || {});
  const U = (FO.util = {});

  /** Parses numbers like 1234, "1234", "1.2M", "1,2 mil", "12K", {count: 5}. Returns null if unknown. */
  U.toNum = function (v) {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "object") return "count" in v ? U.toNum(v.count) : null;
    if (typeof v !== "string") return null;
    const s = v.trim().toLowerCase().replace(/ /g, " ");
    if (/^\d+$/.test(s)) return Number(s);
    const m = s.match(/^(\d+(?:[.,]\d+)*)\s*(k|mil|m|mill|millones|b|bn)?\b/);
    if (!m) return null;
    const suffix = m[2];
    if (!suffix) {
      // "1,234" / "1.234.567" use thousands separators (groups of exactly 3 digits).
      if (/^\d{1,3}([.,]\d{3})+$/.test(m[1])) return Number(m[1].replace(/[.,]/g, ""));
      return Number(m[1].replace(",", "."));
    }
    const base = Number(m[1].replace(",", "."));
    const mult = suffix === "k" || suffix === "mil" ? 1e3 : suffix === "b" || suffix === "bn" ? 1e9 : 1e6;
    return Math.round(base * mult);
  };

  /** Unix seconds, milliseconds, numeric strings or date strings -> epoch ms, or null. */
  U.toDate = function (v) {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "string" && /^\d+$/.test(v)) v = Number(v);
    if (typeof v === "number") {
      if (!Number.isFinite(v) || v <= 0) return null;
      return v < 1e12 ? v * 1000 : v;
    }
    if (typeof v === "string") {
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : null;
    }
    return null;
  };

  /** Returns the URL if it is https and (optionally) on one of the given host suffixes. */
  U.safeUrl = function (u, hostSuffixes) {
    if (typeof u !== "string" || !u) return null;
    try {
      const p = new URL(u);
      if (p.protocol !== "https:") return null;
      if (hostSuffixes && !hostSuffixes.some((h) => p.hostname === h || p.hostname.endsWith("." + h))) return null;
      return p.href;
    } catch (_) {
      return null;
    }
  };

  U.str = function (v) {
    return typeof v === "string" && v.length ? v : null;
  };

  /** Some endpoints prefix "for (;;);" or stream several JSON documents separated by newlines. */
  U.parsePayload = function (text) {
    if (typeof text !== "string") return [];
    let t = text.trim();
    if (t.startsWith("for (;;);")) t = t.slice(9);
    if (!t || (t[0] !== "{" && t[0] !== "[")) return [];
    try {
      return [JSON.parse(t)];
    } catch (_) {
      const out = [];
      for (const line of t.split(/\r?\n/)) {
        let l = line.trim();
        if (l.startsWith("for (;;);")) l = l.slice(9);
        if (!l || (l[0] !== "{" && l[0] !== "[")) continue;
        try {
          out.push(JSON.parse(l));
        } catch (_) {}
      }
      return out;
    }
  };

  /**
   * Depth-first search under `obj` for the first value where test(key, value, parent) returns
   * something other than undefined. Keys matched by `skip` are not entered.
   */
  U.deepFind = function (obj, test, skip, maxDepth) {
    const limit = maxDepth || 40;
    const stack = [[obj, 0]];
    let visited = 0;
    while (stack.length) {
      const [node, depth] = stack.pop();
      if (!node || typeof node !== "object" || depth > limit) continue;
      if (++visited > 200000) return undefined;
      const keys = Array.isArray(node) ? null : Object.keys(node);
      if (keys) {
        for (const k of keys) {
          const r = test(k, node[k], node);
          if (r !== undefined && r !== null) return r;
        }
        for (let i = keys.length - 1; i >= 0; i--) {
          const k = keys[i];
          const v = node[k];
          if (v && typeof v === "object" && !(skip && skip.test(k))) stack.push([v, depth + 1]);
        }
      } else {
        for (let i = node.length - 1; i >= 0; i--) {
          const v = node[i];
          if (v && typeof v === "object") stack.push([v, depth + 1]);
        }
      }
    }
    return undefined;
  };

  /** Collects test(node) results (non-null) for every object under `obj`, up to `max`. Keys matched by `skip` are not entered. */
  U.deepCollect = function (obj, test, skip, max) {
    const out = [];
    const limit = max || 50;
    const stack = [obj];
    let visited = 0;
    while (stack.length && out.length < limit) {
      const node = stack.pop();
      if (!node || typeof node !== "object") continue;
      if (++visited > 200000) break;
      if (!Array.isArray(node)) {
        const r = test(node);
        if (r !== undefined && r !== null) {
          out.push(r);
          continue;
        }
      }
      const keys = Array.isArray(node) ? null : Object.keys(node);
      if (keys) {
        for (let i = keys.length - 1; i >= 0; i--) {
          const v = node[keys[i]];
          if (v && typeof v === "object" && !(skip && skip.test(keys[i]))) stack.push(v);
        }
      } else {
        for (let i = node.length - 1; i >= 0; i--) if (node[i] && typeof node[i] === "object") stack.push(node[i]);
      }
    }
    return out;
  };

  /** A downloadable file: { kind: "video" | "image", url } (https only), or null. */
  U.mediaFile = function (kind, url) {
    const u = U.safeUrl(url);
    return u ? { kind, url: u } : null;
  };

  /** Picks the largest entry of [{ url, width, height }]. */
  U.largest = function (list) {
    if (!Array.isArray(list) || !list.length) return null;
    let best = null;
    for (const x of list) {
      if (!x || typeof x.url !== "string") continue;
      if (!best || (x.width || 0) * (x.height || 0) > (best.width || 0) * (best.height || 0)) best = x;
    }
    return best ? best.url : null;
  };

  /**
   * The creation time hidden in a post id (ms), for posts that arrive without a date.
   * Instagram and X ids are "snowflakes" (time in the high bits); TikTok ids carry Unix seconds in
   * the high 32 bits. The result is only an estimate: the store checks it against posts that do
   * have a date and corrects it (see store.js).
   */
  const ID_TIME = {
    instagram: (n) => Number(n >> 23n) + 1314220021721,
    x: (n) => Number(n >> 22n) + 1288834974657,
    tiktok: (n) => Number(n >> 32n) * 1000,
  };
  U.idTime = function (platform, id) {
    const f = ID_TIME[platform];
    if (!f || id == null || !/^\d{15,20}$/.test(String(id))) return null;
    try {
      const t = f(BigInt(String(id)));
      return t > 1262304000000 && t < Date.now() + 86400000 ? t : null; // 2010 .. tomorrow
    } catch (_) {
      return null;
    }
  };

  /** Like deepFind but returns the value at the first matching key name. */
  U.findKey = function (obj, keyName, accept, skip) {
    return U.deepFind(
      obj,
      (k, v) => (k === keyName && (!accept || accept(v)) ? v : undefined),
      skip
    );
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
