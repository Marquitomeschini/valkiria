(function (root) {
  "use strict";
  const FO = (root.FO = root.FO || {});
  const U = FO.util;
  FO.platforms = FO.platforms || {};

  function pick(v2, v1, key) {
    const a = v2 ? U.toNum(v2[key]) : null;
    return a != null ? a : v1 ? U.toNum(v1[key]) : null;
  }

  function firstUrl(img) {
    return img && img.imageURL && Array.isArray(img.imageURL.urlList) ? img.imageURL.urlList[0] : null;
  }

  // item_list / search / SSR "ItemModule" shape: { id, desc, createTime, author, stats, statsV2, video, imagePost }
  function fromItem(o) {
    const id = String(o.id);
    const author = typeof o.author === "string" ? o.author : U.str(o.author && o.author.uniqueId);
    const s1 = o.stats && typeof o.stats === "object" ? o.stats : null;
    const s2 = o.statsV2 && typeof o.statsV2 === "object" ? o.statsV2 : null;
    const isPhoto = !!o.imagePost;
    const thumb =
      (o.video && (o.video.cover || o.video.originCover || o.video.dynamicCover)) ||
      (isPhoto && (firstUrl(o.imagePost.cover) || (Array.isArray(o.imagePost.images) && firstUrl(o.imagePost.images[0]))));
    let media = [];
    if (isPhoto) {
      media = (Array.isArray(o.imagePost.images) ? o.imagePost.images : []).map((im) => U.mediaFile("image", firstUrl(im))).filter(Boolean);
    } else if (o.video) {
      // TikTok only serves its video files with its cookie and a tiktok.com Referer, so videos are
      // fetched by the extension (see background.js). Several URLs are kept: other qualities/mirrors
      // (h264 first, which plays everywhere) and, last, the watermarked download version.
      const br = (Array.isArray(o.video.bitrateInfo) ? o.video.bitrateInfo : []).slice();
      br.sort((a, b) => (/264/.test(b.CodecType || "") ? 1 : 0) - (/264/.test(a.CodecType || "") ? 1 : 0) || (b.Bitrate || 0) - (a.Bitrate || 0));
      const urls = [o.video.playAddr];
      for (const b of br) if (b && b.PlayAddr && Array.isArray(b.PlayAddr.UrlList)) urls.push(...b.PlayAddr.UrlList);
      urls.push(o.video.downloadAddr);
      const safe = [...new Set(urls.map((u) => U.safeUrl(u)).filter(Boolean))];
      if (safe.length) media = [{ kind: "video", url: safe[0], alts: safe.slice(1, 6), via: "fetch" }];
    }
    return {
      platform: "tiktok",
      id,
      url: "https://www.tiktok.com/@" + encodeURIComponent(author || "") + "/" + (isPhoto ? "photo" : "video") + "/" + encodeURIComponent(id),
      author,
      text: U.str(o.desc),
      thumb: U.safeUrl(thumb),
      date: U.toDate(o.createTime),
      type: isPhoto ? "carousel" : "video",
      views: pick(s2, s1, "playCount"),
      likes: pick(s2, s1, "diggCount"),
      comments: pick(s2, s1, "commentCount"),
      shares: pick(s2, s1, "shareCount"),
      saves: pick(s2, s1, "collectCount"),
      idTime: U.idTime("tiktok", id),
      duration: o.video && typeof o.video.duration === "number" && o.video.duration > 0 ? o.video.duration : null,
      media,
    };
  }

  FO.platforms.tiktok = {
    linkHosts: ["tiktok.com"],
    detect(o) {
      const st = (o.statsV2 && typeof o.statsV2 === "object" && o.statsV2) || (o.stats && typeof o.stats === "object" && o.stats);
      if (st && "playCount" in st && o.id != null && /^\d+$/.test(String(o.id)) && ("desc" in o || "createTime" in o)) {
        return { item: fromItem(o) };
      }
      return null;
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
