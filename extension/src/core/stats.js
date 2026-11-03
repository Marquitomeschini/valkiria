(function (root) {
  "use strict";
  const FO = (root.FO = root.FO || {});
  const DAY = 86400000;
  const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]; // Monday first
  const HASHTAG = /#[\p{L}\p{N}_]{2,40}/gu;

  function median(xs) {
    const s = xs.filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
    if (!s.length) return null;
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /**
   * Profile summary for a list of posts. "metric" is views when at least half the posts have them
   * (reels, TikTok, X), otherwise likes (photo-heavy Instagram/Facebook pages).
   */
  FO.stats = {
    median,
    WEEKDAYS,
    summarize(items, opts) {
      const now = (opts && opts.now) || Date.now();
      const withViews = items.filter((i) => typeof i.views === "number");
      const metric = withViews.length >= items.length / 2 && withViews.length ? "views" : "likes";
      const val = (i) => (metric === "views" ? i.views : i.likes);
      const dated = items.filter((i) => i.date != null).sort((a, b) => a.date - b.date);
      const spanDays = dated.length > 1 ? (dated[dated.length - 1].date - dated[0].date) / DAY : 0;

      const byWeekday = WEEKDAYS.map((label) => ({ label, values: [] }));
      const byHour = Array.from({ length: 24 }, (_, h) => ({ label: String(h).padStart(2, "0"), values: [] }));
      for (const it of dated) {
        const v = val(it);
        if (typeof v !== "number") continue;
        const d = new Date(it.date);
        byWeekday[(d.getDay() + 6) % 7].values.push(v);
        // Estimated dates (from the post id) are exact to the second, so hours are kept too.
        byHour[d.getHours()].values.push(v);
      }
      const finish = (rows) => rows.map((r) => ({ label: r.label, value: median(r.values), n: r.values.length }));

      const tags = new Map();
      for (const it of items) {
        const found = new Set((it.text || "").toLowerCase().match(HASHTAG) || []);
        for (const t of found) {
          if (!tags.has(t)) tags.set(t, []);
          const v = val(it);
          if (typeof v === "number") tags.get(t).push(v);
        }
      }
      let hashtags = [...tags].map(([tag, vs]) => ({ label: tag, value: median(vs), n: vs.length })).filter((t) => t.value != null);
      const repeated = hashtags.filter((t) => t.n >= 2);
      hashtags = (repeated.length >= 3 ? repeated : hashtags).sort((a, b) => b.value - a.value).slice(0, 8);

      const types = {};
      for (const it of items) types[it.type] = (types[it.type] || 0) + 1;

      return {
        count: items.length,
        metric,
        medianMetric: median(items.map(val)),
        medianViews: median(items.map((i) => i.views)),
        medianLikes: median(items.map((i) => i.likes)),
        medianComments: median(items.map((i) => i.comments)),
        medianEngagement: median(items.map((i) => i.engagement)),
        medianVelocity: median(items.map((i) => i.velocity)),
        postsPerWeek: spanDays >= 1 ? (dated.length - 1) / (spanDays / 7) : null,
        spanDays,
        first: dated.length ? dated[0].date : null,
        last: dated.length ? dated[dated.length - 1].date : null,
        lastPostDaysAgo: dated.length ? (now - dated[dated.length - 1].date) / DAY : null,
        estimatedDates: items.some((i) => i.dateEstimated),
        byWeekday: finish(byWeekday),
        byHour: finish(byHour),
        hashtags,
        types,
        timeline: dated.filter((i) => typeof val(i) === "number").map((i) => ({ x: i.date, y: val(i), item: i })),
      };
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
