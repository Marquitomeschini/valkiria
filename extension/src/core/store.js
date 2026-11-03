(function (root) {
  "use strict";
  const FO = (root.FO = root.FO || {});

  const METRICS = ["views", "likes", "comments", "shares", "saves"];
  const MAX_ITEMS = 20000;

  /** Engagement = (likes + comments) / views. Null when views are unknown or zero. */
  function engagement(it) {
    if (!it.views) return null;
    if (it.likes == null && it.comments == null) return null;
    return ((it.likes || 0) + (it.comments || 0)) / it.views;
  }

  function median(values) {
    if (!values.length) return null;
    const s = values.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /**
   * Outlier score = how many times a post beats the profile's typical post:
   * views / median views of the posts loaded for that page (likes / median likes when a post has no views).
   */
  function assignOutliers(items) {
    const mv = median(items.map((i) => i.views).filter((v) => typeof v === "number" && v > 0));
    const ml = median(items.map((i) => i.likes).filter((v) => typeof v === "number" && v > 0));
    for (const it of items) {
      if (it.views != null && mv) it.outlier = it.views / mv;
      else if (it.likes != null && ml) it.outlier = it.likes / ml;
      else it.outlier = null;
    }
  }

  function Store() {
    this.items = new Map(); // id -> item
    this.pending = new Map(); // id -> metrics that arrived before the post itself
    this.seq = 0;
    this.listeners = new Set();
  }

  Store.prototype.onChange = function (fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  Store.prototype._emit = function () {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch (_) {}
    }
  };

  function mergeInto(target, src) {
    for (const k of Object.keys(src)) {
      if (k === "ctxs" || k === "seq") continue;
      const v = src[k];
      if (v === null || v === undefined) continue;
      if (Array.isArray(v) && !v.length && Array.isArray(target[k]) && target[k].length) continue; // keep known files
      if (METRICS.includes(k) && typeof target[k] === "number" && typeof v === "number") {
        target[k] = Math.max(target[k], v); // counts only grow; keep the freshest (largest)
      } else {
        target[k] = v;
      }
    }
  }

  /** Adds extracted items/partials seen while the page context was `ctx`. Returns how many were new. */
  Store.prototype.add = function (items, partials, ctx) {
    let added = 0;
    let changed = false;
    for (const it of items) {
      let cur = this.items.get(it.id);
      if (!cur) {
        if (this.items.size >= MAX_ITEMS) break;
        cur = Object.assign({ seq: this.seq++, ctxs: new Set() }, it);
        this.items.set(it.id, cur);
        added++;
        const p = this.pending.get(it.id);
        if (p) {
          mergeInto(cur, p);
          this.pending.delete(it.id);
        }
      } else {
        mergeInto(cur, it);
      }
      if (ctx != null) cur.ctxs.add(ctx);
      cur.engagement = engagement(cur);
      changed = true;
    }
    for (const p of partials || []) {
      const cur = this.items.get(p.id);
      if (cur) {
        mergeInto(cur, p);
        cur.engagement = engagement(cur);
        changed = true;
      } else if (this.pending.size < MAX_ITEMS) {
        const prev = this.pending.get(p.id) || {};
        mergeInto(prev, p);
        this.pending.set(p.id, prev);
      }
    }
    if (changed) this._emit();
    return added;
  };

  Store.prototype.clear = function (ctx) {
    if (ctx == null) {
      this.items.clear();
      this.pending.clear();
    } else {
      for (const [id, it] of this.items) {
        it.ctxs.delete(ctx);
        if (!it.ctxs.size) this.items.delete(id);
      }
    }
    this._emit();
  };

  Store.prototype.count = function (ctx) {
    if (ctx == null) return this.items.size;
    let n = 0;
    for (const it of this.items.values()) if (it.ctxs.has(ctx)) n++;
    return n;
  };

  /** Items of a context in feed order (the order the site showed them). */
  Store.prototype.inCtx = function (ctx) {
    const out = [];
    for (const it of this.items.values()) if (ctx == null || it.ctxs.has(ctx)) out.push(it);
    return out.sort((a, b) => a.seq - b.seq);
  };

  // sortKey -> [field, default direction]
  const SORTS = {
    views: ["views", "desc"],
    likes: ["likes", "desc"],
    comments: ["comments", "desc"],
    shares: ["shares", "desc"],
    engagement: ["engagement", "desc"],
    outlier: ["outlier", "desc"],
    newest: ["date", "desc"],
    oldest: ["date", "asc"],
    date: ["date", "desc"],
    feed: ["seq", "asc"],
  };
  FO.SORTS = SORTS;

  /**
   * opts: { ctx, sortKey, dir, type, from, to (epoch ms), minViews, query, limit, ids (Set) }
   * `limit` keeps only the N most recent posts of the feed (by feed order) before sorting.
   * Unknown values always go last, whatever the direction.
   */
  Store.prototype.query = function (opts) {
    const o = opts || {};
    let base = this.inCtx(o.ctx);
    if (o.limit) base = base.slice(0, o.limit);
    // The date range defines the set of posts being compared, so it also defines the outlier baseline.
    if (o.from != null) base = base.filter((it) => it.date != null && it.date >= o.from);
    if (o.to != null) base = base.filter((it) => it.date != null && it.date <= o.to);
    assignOutliers(base);
    const q = (o.query || "").trim().toLowerCase();
    const out = [];
    for (const it of base) {
      if (o.ids && !o.ids.has(it.id)) continue;
      if (o.type && o.type !== "all" && it.type !== o.type) continue;
      if (o.minViews != null && o.minViews > 0 && (it.views == null || it.views < o.minViews)) continue;
      if (q) {
        const hay = ((it.text || "") + " " + (it.author || "") + " @" + (it.author || "")).toLowerCase();
        if (!hay.includes(q)) continue;
      }
      out.push(it);
    }
    const [field, defDir] = SORTS[o.sortKey] || SORTS.views;
    const sign = (o.dir || defDir) === "asc" ? 1 : -1;
    out.sort((a, b) => {
      const va = a[field];
      const vb = b[field];
      if (va == null && vb == null) return a.seq - b.seq;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va === vb) return a.seq - b.seq;
      return (va - vb) * sign;
    });
    return out;
  };

  FO.Store = Store;
  FO.engagement = engagement;
  FO.median = median;
})(typeof globalThis !== "undefined" ? globalThis : this);
