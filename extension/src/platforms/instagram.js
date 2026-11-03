(function (root) {
  "use strict";
  const FO = (root.FO = root.FO || {});
  const U = FO.util;
  FO.platforms = FO.platforms || {};

  function firstCandidate(iv) {
    return iv && Array.isArray(iv.candidates) && iv.candidates[0] ? iv.candidates[0].url : null;
  }

  function mediaOfModern(m) {
    if (Array.isArray(m.carousel_media) && m.carousel_media.length) {
      return m.carousel_media.map((c) => mediaOfModern(c)[0]).filter(Boolean);
    }
    if (Array.isArray(m.video_versions) && m.video_versions.length) return [U.mediaFile("video", U.largest(m.video_versions))].filter(Boolean);
    // Grids (e.g. the profile's reels tab) send trimmed posts without the video or the carousel
    // items; leave them empty so the download asks Instagram for the full post (resolveMedia).
    if (m.media_type === 2 || m.media_type === 8 || m.product_type === "clips") return [];
    const img = U.largest(m.image_versions2 && m.image_versions2.candidates);
    return [U.mediaFile("image", img)].filter(Boolean);
  }

  function mediaOfLegacy(n) {
    const kids = n.edge_sidecar_to_children && n.edge_sidecar_to_children.edges;
    if (Array.isArray(kids) && kids.length) return kids.map((e) => e && e.node && mediaOfLegacy(e.node)[0]).filter(Boolean);
    if (n.is_video && n.video_url) return [U.mediaFile("video", n.video_url)].filter(Boolean);
    return [U.mediaFile("image", n.display_url || n.thumbnail_src)].filter(Boolean);
  }

  // Current web API shape (graphql/query "xdt_api__v1__..." and /api/v1/... feeds, reels, tags).
  function fromModern(m) {
    const code = m.code;
    const type =
      m.product_type === "clips" ? "reel" : m.media_type === 8 ? "carousel" : m.media_type === 2 ? "video" : "photo";
    const firstChild = Array.isArray(m.carousel_media) ? m.carousel_media[0] : null;
    const thumb =
      firstCandidate(m.image_versions2) || (firstChild && firstCandidate(firstChild.image_versions2)) || m.display_uri;
    const shares = U.toNum(m.reshare_count != null ? m.reshare_count : m.share_count);
    const pk = m.pk != null ? String(m.pk) : typeof m.id === "string" ? m.id.split("_")[0] : null;
    return {
      platform: "instagram",
      id: code,
      pk: pk && /^\d+$/.test(pk) ? pk : null,
      idTime: U.idTime("instagram", pk),
      duration: typeof m.video_duration === "number" ? m.video_duration : null,
      url: "https://www.instagram.com/" + (type === "reel" ? "reel" : "p") + "/" + encodeURIComponent(code) + "/",
      author: U.str(m.user && m.user.username) || U.str(m.owner && m.owner.username),
      text: U.str(m.caption && m.caption.text),
      thumb: U.safeUrl(thumb),
      date: U.toDate(m.taken_at),
      type,
      views: U.toNum(m.play_count != null ? m.play_count : m.ig_play_count != null ? m.ig_play_count : m.view_count != null ? m.view_count : m.video_view_count),
      likes: m.like_and_view_counts_disabled ? null : U.toNum(m.like_count),
      comments: U.toNum(m.comment_count),
      shares,
      saves: U.toNum(m.save_count),
      media: mediaOfModern(m),
    };
  }

  // Older GraphQL shape (edge_owner_to_timeline_media etc.).
  function fromLegacy(n) {
    const isVideo = n.is_video === true || n.__typename === "GraphVideo";
    const type =
      n.product_type === "clips" ? "reel" : n.__typename === "GraphSidecar" ? "carousel" : isVideo ? "video" : "photo";
    const likes = n.edge_media_preview_like || n.edge_liked_by;
    const capEdges = n.edge_media_to_caption && n.edge_media_to_caption.edges;
    return {
      platform: "instagram",
      id: n.shortcode,
      url: "https://www.instagram.com/" + (type === "reel" ? "reel" : "p") + "/" + encodeURIComponent(n.shortcode) + "/",
      author: U.str(n.owner && n.owner.username),
      text: U.str(capEdges && capEdges[0] && capEdges[0].node && capEdges[0].node.text),
      thumb: U.safeUrl(n.thumbnail_src || n.display_url),
      date: U.toDate(n.taken_at_timestamp),
      type,
      views: U.toNum(n.video_play_count != null ? n.video_play_count : n.video_view_count),
      likes: U.toNum(likes && likes.count),
      comments: U.toNum(n.edge_media_to_comment && n.edge_media_to_comment.count),
      shares: null,
      saves: null,
      duration: typeof n.video_duration === "number" ? n.video_duration : null,
      media: mediaOfLegacy(n),
    };
  }

  const METRIC_KEYS = ["play_count", "ig_play_count", "view_count", "like_count", "comment_count"];

  /**
   * Fills in the files (and date/author when missing) of trimmed posts by asking Instagram for the
   * full post, like its web app does: GET /api/v1/media/<id>/info/ with the session's cookies.
   */
  async function resolveMedia(items, onProgress) {
    let done = 0;
    for (const it of items) {
      if (!it.pk) continue;
      try {
        const r = await fetch(location.origin + "/api/v1/media/" + it.pk + "/info/", {
          credentials: "include",
          headers: { "x-ig-app-id": "936619743392459", "x-requested-with": "XMLHttpRequest" },
        });
        if (r.ok) {
          const full = FO.extract("instagram", await r.json()).items.find((x) => x.id === it.id);
          if (full) {
            if (full.media && full.media.length) it.media = full.media;
            if (it.date == null && full.date != null) it.date = full.date;
            if (!it.author && full.author) it.author = full.author;
          }
        }
      } catch (_) {}
      onProgress && onProgress(++done, items.length);
      await new Promise((res) => setTimeout(res, 250)); // be gentle with Instagram
    }
  }

  FO.platforms.instagram = {
    resolveMedia,
    linkHosts: ["instagram.com"],
    detect(o) {
      // A post: has its shortcode and an id, plus a date or a count. The profile's reels tab sends
      // trimmed posts with counts but no date, so the date is not required.
      if (
        typeof o.code === "string" &&
        /^[A-Za-z0-9_-]{5,}$/.test(o.code) &&
        (o.pk != null || o.id != null || "media_type" in o) &&
        (typeof o.taken_at === "number" || METRIC_KEYS.some((k) => k in o))
      ) {
        return { item: fromModern(o) };
      }
      if (typeof o.shortcode === "string" && (o.edge_media_preview_like || o.edge_liked_by || o.edge_media_to_comment)) {
        return { item: fromLegacy(o) };
      }
      return null;
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
