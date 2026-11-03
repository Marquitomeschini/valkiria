(function (root) {
  "use strict";
  const FO = (root.FO = root.FO || {});
  FO.platforms = FO.platforms || {};

  /**
   * Walks any JSON value and asks the platform adapter to recognise posts.
   * adapter.detect(obj) may return:
   *   { item }     a complete post (the walker does not descend into it)
   *   { partial }  metrics for a post identified elsewhere (merged later)
   *   { descend }  objects to walk instead of this one
   *   null         keep walking into the object's children
   */
  FO.extract = function (platformId, data) {
    const adapter = FO.platforms[platformId];
    const items = [];
    const partials = [];
    if (!adapter) return { items, partials };
    const stack = [data];
    let visited = 0;
    while (stack.length) {
      const node = stack.pop();
      if (node === null || typeof node !== "object") continue;
      if (++visited > 3000000) break;
      if (Array.isArray(node)) {
        for (let i = node.length - 1; i >= 0; i--) stack.push(node[i]);
        continue;
      }
      if (adapter.skip && adapter.skip(node)) continue;
      let res = null;
      try {
        res = adapter.detect(node);
      } catch (_) {
        res = null;
      }
      if (res) {
        if (res.item && res.item.id && res.item.url) items.push(res.item);
        if (res.partial && res.partial.id) partials.push(res.partial);
        if (res.descend) for (let i = res.descend.length - 1; i >= 0; i--) stack.push(res.descend[i]);
        continue;
      }
      const keys = Object.keys(node);
      for (let i = keys.length - 1; i >= 0; i--) {
        const v = node[keys[i]];
        if (v && typeof v === "object") stack.push(v);
      }
    }
    return { items, partials };
  };

  // Pages that open on top of a profile/search (a post, a photo viewer...) keep the previous context.
  const OVERLAY_SEGMENTS = {
    instagram: ["p", "reel", "tv", "stories", "direct", "accounts", "create"],
    tiktok: ["video", "photo", "messages", "upload", "setting"],
    x: ["compose", "settings", "messages", "notifications"],
    facebook: ["photo", "photo.php", "story.php", "permalink.php", "messages", "notifications", "media"],
  };

  /**
   * Identifies "which list am I looking at" (a profile, a search, a hashtag, the home feed) so
   * posts captured on one profile are not mixed with another. Returns null for overlay pages.
   */
  FO.ctxKey = function (platformId, href) {
    let u;
    try {
      u = new URL(href);
    } catch (_) {
      return null;
    }
    const segs = u.pathname.split("/").filter(Boolean);
    const first = (segs[0] || "").toLowerCase();
    if (!first) return "home";
    if ((OVERLAY_SEGMENTS[platformId] || []).includes(first)) return null;
    if (first === "search") return "search:" + (u.searchParams.get("q") || "").toLowerCase();
    if (first === "profile.php") return "profile:" + (u.searchParams.get("id") || "");
    if (platformId === "x" && first === "i") {
      if (["web", "flow"].includes((segs[1] || "").toLowerCase())) return null;
      return segs.slice(0, 3).join("/").toLowerCase();
    }
    if (platformId === "instagram" && (segs[1] || "").toLowerCase() === "tagged") return first + "/tagged";
    if (["explore", "tag", "hashtag", "groups", "pages", "people"].includes(first)) {
      return segs.slice(0, 3).join("/").toLowerCase();
    }
    return first;
  };

  // Pages whose first path segment is not a username.
  const NOT_PROFILES = {
    instagram: ["home", "reels", "explore", "direct", "stories", "accounts", "p", "reel", "tv"],
    x: ["home", "explore", "notifications", "messages", "search", "settings", "compose", "i"],
  };
  /** The account a context is the profile of (lowercase), or null for searches, feeds, etc. */
  FO.profileOwner = function (platformId, ctx) {
    if (typeof ctx !== "string") return null;
    if (platformId === "tiktok") return /^@[\w.]+$/.test(ctx) ? ctx.slice(1).toLowerCase() : null;
    if (platformId === "instagram") return /^[a-z0-9._]{1,30}$/.test(ctx) && !NOT_PROFILES.instagram.includes(ctx) ? ctx : null;
    if (platformId === "x") return /^[a-z0-9_]{1,15}$/.test(ctx) && !NOT_PROFILES.x.includes(ctx) ? ctx : null;
    return null; // Facebook shows display names, not usernames
  };
  /**
   * On a profile, only the account's own posts count: sites load recommended posts from other
   * accounts in the background. Posts that don't say who posted them are kept.
   */
  FO.belongsTo = function (item, platformId, ctx) {
    const owner = FO.profileOwner(platformId, ctx);
    if (!owner || !item || !item.author) return true;
    return String(item.author).toLowerCase() === owner;
  };

  FO.platformForHost = function (hostname) {
    if (/(^|\.)instagram\.com$/.test(hostname)) return "instagram";
    if (/(^|\.)tiktok\.com$/.test(hostname)) return "tiktok";
    if (/(^|\.)(x|twitter)\.com$/.test(hostname)) return "x";
    if (/(^|\.)facebook\.com$/.test(hostname)) return "facebook";
    return null;
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
