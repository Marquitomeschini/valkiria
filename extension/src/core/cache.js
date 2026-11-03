(function (root) {
  "use strict";
  const FO = (root.FO = root.FO || {});

  // Everything lives in chrome.storage.local (with "unlimitedStorage"): it stays in this browser,
  // is shared by the content scripts and the extension's own pages, and survives restarts.
  const INDEX = "fo_cache_index";
  const MAX_PROFILES = 40;
  const COLLECTIONS = "fo_collections";

  function area() {
    try {
      return chrome.storage && chrome.storage.local;
    } catch (_) {
      return null; // the extension was reloaded and this page still runs the old copy
    }
  }
  function get(keys) {
    const a = area();
    return a ? a.get(keys).catch(() => ({})) : Promise.resolve({});
  }
  function set(obj) {
    const a = area();
    return a ? a.set(obj).catch(() => {}) : Promise.resolve();
  }
  function remove(keys) {
    const a = area();
    return a ? a.remove(keys).catch(() => {}) : Promise.resolve();
  }

  const key = (platform, ctx) => "fo_cache:" + platform + ":" + ctx;

  FO.cache = {
    key,
    /** Saves the posts loaded for a page (profile, search, hashtag). */
    async save(platform, ctx, label, items, meta) {
      if (!items.length || String(ctx).startsWith("otros:")) return;
      const k = key(platform, ctx);
      const entry = Object.assign({ v: 1, platform, ctx, label, savedAt: Date.now(), count: items.length, items }, meta || {});
      const idx = ((await get(INDEX))[INDEX] || []).filter((e) => e.key !== k);
      idx.unshift({ key: k, platform, ctx, label, savedAt: entry.savedAt, count: items.length, complete: !!entry.complete });
      const evicted = idx.splice(MAX_PROFILES);
      await set({ [k]: entry, [INDEX]: idx });
      if (evicted.length) await remove(evicted.map((e) => e.key));
    },
    async load(platform, ctx) {
      const k = key(platform, ctx);
      return (await get(k))[k] || null;
    },
    /** Index entry only (cheap: no posts), or null. */
    async info(platform, ctx) {
      const k = key(platform, ctx);
      return ((await get(INDEX))[INDEX] || []).find((e) => e.key === k) || null;
    },
    async loadKey(k) {
      return (await get(k))[k] || null;
    },
    /** Saved pages, newest first: [{ key, platform, ctx, label, savedAt, count, complete }] */
    async list() {
      return (await get(INDEX))[INDEX] || [];
    },
    async remove(k) {
      const idx = ((await get(INDEX))[INDEX] || []).filter((e) => e.key !== k);
      await set({ [INDEX]: idx });
      await remove(k);
    },
  };

  const itemKey = (it) => it.platform + ":" + it.id;

  FO.collections = {
    /** { name: { created, updated, items: [post, ...] } } */
    async all() {
      return (await get(COLLECTIONS))[COLLECTIONS] || {};
    },
    async names() {
      const all = await FO.collections.all();
      return Object.keys(all).sort((a, b) => (all[b].updated || 0) - (all[a].updated || 0));
    },
    /** Adds posts to a collection (created if needed). Returns how many were new. */
    async add(name, items) {
      name = String(name || "").trim().slice(0, 60);
      if (!name) return 0;
      const all = await FO.collections.all();
      const c = all[name] || { created: Date.now(), items: [] };
      const have = new Set(c.items.map(itemKey));
      let added = 0;
      for (const it of items) {
        if (have.has(itemKey(it))) continue;
        c.items.push(Object.assign({ savedAt: Date.now() }, it));
        have.add(itemKey(it));
        added++;
      }
      c.updated = Date.now();
      all[name] = c;
      await set({ [COLLECTIONS]: all });
      return added;
    },
    async removeItem(name, platform, id) {
      const all = await FO.collections.all();
      if (!all[name]) return;
      all[name].items = all[name].items.filter((it) => !(it.platform === platform && it.id === id));
      all[name].updated = Date.now();
      await set({ [COLLECTIONS]: all });
    },
    async removeCollection(name) {
      const all = await FO.collections.all();
      delete all[name];
      await set({ [COLLECTIONS]: all });
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
