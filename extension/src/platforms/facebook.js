(function (root) {
  "use strict";
  const FO = (root.FO = root.FO || {});
  const U = FO.util;
  FO.platforms = FO.platforms || {};

  // Facebook's GraphQL is deeply nested and changes often, so metrics are searched for inside
  // each post instead of reading fixed paths. Shared posts and comments are skipped so their
  // numbers are not mistaken for the post's own.
  const SKIP_SHARED = /^(attached_story|attached_story_layout)$/;
  const SKIP_FOR_POST_METRICS = /comment|attached_story|reply|replies|top_reactions|reactors_list/i;
  const SKIP_FOR_COMMENT_COUNT = /^(edges|nodes|attached_story)$/;
  const SKIP_FOR_THUMB = /actor|profile|avatar|owning|author|feedback|comment|attached_story/i;
  const POST_URL = /facebook\.com\/.*(\/posts\/|\/videos\/|\/reel\/|permalink|story_fbid|\/photo|watch|fbid=)/;

  function num(v) {
    return typeof v === "number" ? v : null;
  }

  function metrics(o) {
    const likes = U.deepFind(
      o,
      (k, v) =>
        (k === "reaction_count" || k === "reactors") && v && typeof v === "object" ? num(v.count) : undefined,
      SKIP_FOR_POST_METRICS
    );
    const comments = U.deepFind(
      o,
      (k, v) => {
        if (k === "total_comment_count") return num(v);
        if ((k === "comments" || k === "comment_count") && v && typeof v === "object") return num(v.total_count);
        return undefined;
      },
      SKIP_FOR_COMMENT_COUNT
    );
    const shares = U.deepFind(
      o,
      (k, v) => (k === "share_count" && v && typeof v === "object" ? num(v.count) : undefined),
      SKIP_FOR_POST_METRICS
    );
    const views = U.deepFind(
      o,
      (k, v) => (k === "video_view_count" || k === "play_count" || k === "video_play_count" ? num(v) : undefined),
      SKIP_FOR_POST_METRICS
    );
    return { likes: likes ?? null, comments: comments ?? null, shares: shares ?? null, views: views ?? null };
  }

  function thumbOf(o) {
    return U.deepFind(
      o,
      (k, v) => {
        if (!v || typeof v !== "object") return undefined;
        if (k === "photo_image" || k === "thumbnailImage" || k === "large_share_image") return U.safeUrl(v.uri);
        if (k === "preferred_thumbnail") return U.safeUrl(v.image && v.image.uri);
        return undefined;
      },
      SKIP_FOR_THUMB
    );
  }

  const VIDEO_URL_KEYS = ["browser_native_hd_url", "playable_url_quality_hd", "browser_native_sd_url", "playable_url"];
  function videoUrl(v) {
    for (const k of VIDEO_URL_KEYS) if (typeof v[k] === "string") return v[k];
    return null;
  }
  // Videos and photos attached to the post (not the author's avatar, comments or a shared post).
  function mediaOf(o) {
    const seen = new Set();
    return U.deepCollect(
      o,
      (n) => {
        let f = null;
        if (n.__typename === "Video" && videoUrl(n)) f = U.mediaFile("video", videoUrl(n));
        else if (n.__typename === "Photo") f = U.mediaFile("image", (n.photo_image && n.photo_image.uri) || (n.image && n.image.uri));
        if (!f) return undefined;
        if (seen.has(f.url)) return false;
        seen.add(f.url);
        return f;
      },
      SKIP_FOR_THUMB,
      30
    ).filter(Boolean);
  }

  function durationOf(o) {
    const ms = U.deepFind(o, (k, v) => (k === "playable_duration_in_ms" && typeof v === "number" ? v : undefined), SKIP_FOR_POST_METRICS);
    if (ms) return ms / 1000;
    const sec = U.deepFind(o, (k, v) => (k === "length_in_second" && typeof v === "number" ? v : undefined), SKIP_FOR_POST_METRICS);
    return sec || null;
  }

  function fromStory(s) {
    const m = metrics(s);
    const url =
      U.deepFind(
        s,
        (k, v) =>
          (k === "permalink_url" || k === "url" || k === "wwwURL") && typeof v === "string" && POST_URL.test(v)
            ? U.safeUrl(v, ["facebook.com"])
            : undefined,
        SKIP_SHARED
      ) || "https://www.facebook.com/" + encodeURIComponent(s.post_id);
    const text = U.deepFind(
      s,
      (k, v) => (k === "message" && v && typeof v === "object" ? U.str(v.text) : undefined),
      SKIP_SHARED
    );
    const author = U.deepFind(
      s,
      (k, v) => (k === "actors" && Array.isArray(v) && v[0] ? U.str(v[0].name) : undefined),
      SKIP_SHARED
    );
    const date = U.deepFind(s, (k, v) => (k === "creation_time" ? num(v) : undefined), SKIP_SHARED);
    const thumb = thumbOf(s);
    return {
      platform: "facebook",
      id: s.post_id,
      url,
      author: author || null,
      text: text || null,
      thumb: thumb || null,
      date: U.toDate(date),
      type: m.views != null ? (/\/reel\//.test(url) ? "reel" : "video") : thumb ? "photo" : "text",
      duration: durationOf(s),
      views: m.views,
      likes: m.likes,
      comments: m.comments,
      shares: m.shares,
      saves: null,
      media: mediaOf(s),
    };
  }

  // Reels / video tabs return Video nodes that are not wrapped in a Story.
  function fromVideo(v) {
    const m = metrics(v);
    const url =
      U.safeUrl(v.permalink_url, ["facebook.com"]) ||
      U.safeUrl(v.url, ["facebook.com"]) ||
      "https://www.facebook.com/watch/?v=" + encodeURIComponent(v.id);
    return {
      platform: "facebook",
      id: "video:" + v.id,
      url,
      author: U.str(v.owner && v.owner.name),
      text: U.str(v.title && v.title.text) || U.str(v.message && v.message.text),
      thumb:
        U.safeUrl(v.preferred_thumbnail && v.preferred_thumbnail.image && v.preferred_thumbnail.image.uri) ||
        U.safeUrl(v.thumbnailImage && v.thumbnailImage.uri) ||
        U.safeUrl(v.image && v.image.uri),
      date: U.toDate(v.publish_time != null ? v.publish_time : v.creation_time),
      type: /\/reel\//.test(url) ? "reel" : "video",
      duration: durationOf(v),
      views: num(v.play_count) ?? num(v.video_view_count) ?? m.views,
      likes: m.likes,
      comments: m.comments,
      shares: m.shares,
      saves: null,
      media: videoUrl(v) ? [U.mediaFile("video", videoUrl(v))].filter(Boolean) : [],
    };
  }

  // Feedback ids are base64("feedback:<post_id>"); deferred response chunks carry counts this way.
  function postIdFromFeedbackId(id) {
    if (typeof id !== "string" || id.length > 80) return null;
    try {
      const m = /^feedback:(\d+)$/.exec(atob(id));
      return m ? m[1] : null;
    } catch (_) {
      return null;
    }
  }

  FO.platforms.facebook = {
    linkHosts: ["facebook.com"],
    detect(o) {
      if (o.__typename === "Story" && typeof o.post_id === "string" && /^\d+$/.test(o.post_id)) {
        return { item: fromStory(o) };
      }
      if (o.__typename === "Video" && typeof o.id === "string" && (num(o.play_count) != null || num(o.video_view_count) != null)) {
        return { item: fromVideo(o) };
      }
      if (o.__typename === "Feedback") {
        const pid = postIdFromFeedbackId(o.id);
        if (pid) {
          const m = metrics(o);
          if (m.likes != null || m.comments != null || m.shares != null || m.views != null) {
            return { partial: Object.assign({ platform: "facebook", id: pid }, m) };
          }
        }
      }
      return null;
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
