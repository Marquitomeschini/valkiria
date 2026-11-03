(function (root) {
  "use strict";
  const FO = (root.FO = root.FO || {});
  const U = FO.util;
  FO.platforms = FO.platforms || {};

  function screenName(t) {
    const u = t.core && t.core.user_results && t.core.user_results.result;
    if (!u) return null;
    return U.str(u.core && u.core.screen_name) || U.str(u.legacy && u.legacy.screen_name);
  }

  function mediaOf(list) {
    return list
      .map((m) => {
        if (!m) return null;
        if (m.type === "video" || m.type === "animated_gif") {
          const mp4 = ((m.video_info && m.video_info.variants) || []).filter((v) => v && v.content_type === "video/mp4" && v.url);
          mp4.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
          return mp4[0] ? U.mediaFile("video", mp4[0].url) : null;
        }
        const u = U.safeUrl(m.media_url_https);
        return u ? U.mediaFile("image", u + (u.includes("?") ? "&" : "?") + "name=orig") : null;
      })
      .filter(Boolean);
  }

  // GraphQL Tweet: { rest_id, core.user_results, legacy{ favorite_count, reply_count, ... }, views{count}, note_tweet }
  function fromTweet(t) {
    const L = t.legacy;
    const media = (L.extended_entities && L.extended_entities.media) || (L.entities && L.entities.media) || [];
    const hasVideo = media.some((m) => m && (m.type === "video" || m.type === "animated_gif"));
    const note = t.note_tweet && t.note_tweet.note_tweet_results && t.note_tweet.note_tweet_results.result;
    const sn = screenName(t);
    const rt = U.toNum(L.retweet_count);
    const qt = U.toNum(L.quote_count);
    return {
      platform: "x",
      id: t.rest_id,
      url: "https://x.com/" + (sn ? encodeURIComponent(sn) : "i/web") + "/status/" + encodeURIComponent(t.rest_id),
      author: sn,
      text: U.str(note && note.text) || U.str(L.full_text),
      thumb: U.safeUrl(media[0] && media[0].media_url_https),
      date: U.toDate(L.created_at),
      type: hasVideo ? "video" : media.length ? "photo" : "text",
      views: U.toNum(t.views && t.views.count),
      likes: U.toNum(L.favorite_count),
      comments: U.toNum(L.reply_count),
      shares: rt == null && qt == null ? null : (rt || 0) + (qt || 0),
      saves: U.toNum(L.bookmark_count),
      media: mediaOf(media),
    };
  }

  FO.platforms.x = {
    linkHosts: ["x.com", "twitter.com"],
    skip(o) {
      return "promotedMetadata" in o; // ads
    },
    detect(o) {
      const L = o.legacy;
      // Tweets use "favorite_count"; user objects use "favourites_count".
      if (typeof o.rest_id === "string" && L && typeof L === "object" && "favorite_count" in L && "created_at" in L) {
        const original = L.retweeted_status_result && L.retweeted_status_result.result;
        if (original) return { descend: [original] }; // a repost: keep the original post and its counts
        return { item: fromTweet(o) };
      }
      return null;
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
