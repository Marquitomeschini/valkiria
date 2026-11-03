// End-to-end check: loads the unpacked extension in Chromium and serves fake pages on the real
// platform URLs (all requests are answered locally by Playwright; nothing reaches the internet).
// The fake pages request more posts while scrolling, like the real sites do.
// Run with: node test/e2e.mjs [--shots <dir>]
import { createRequire } from "node:module";
import { readFileSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import https from "node:https";
import os from "node:os";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.join(here, "..", "extension");
const shotsIdx = process.argv.indexOf("--shots");
const SHOTS = shotsIdx > 0 ? process.argv[shotsIdx + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const PAGES = 6;
const NOW = Date.now();
const DAY = 86400000;
const PER_PAGE = 12;

// ---------- deterministic fake data ----------
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const WORDS = ["receta", "viaje", "tutorial", "humor", "música", "fútbol", "mate", "asado", "playa", "code", "gatos", "perros"];

function makeData(platform) {
  const r = rng(platform.length * 7919);
  const posts = [];
  for (let i = 0; i < PAGES * PER_PAGE; i++) {
    const kind = r();
    const views = Math.round(500 + r() ** 3 * 2_000_000);
    const likes = Math.round(views * (0.01 + r() * 0.12));
    const comments = Math.round(likes * (0.01 + r() * 0.08));
    const shares = Math.round(likes * r() * 0.2);
    const date = Math.floor((NOW - (i * 3 + 1.5) * DAY) / 1000); // newest first, one post every 3 days
    const text = WORDS[i % WORDS.length] + " " + i + (i % 5 === 0 ? " #promo" : "");
    posts.push({ i, kind, views, likes, comments, shares, date, text });
  }
  return posts;
}

const thumbHost = { instagram: "scontent.cdninstagram.com", tiktok: "p16-sign.tiktokcdn.com", x: "pbs.twimg.com", facebook: "scontent.xx.fbcdn.net" };

// Expected normalized values, computed independently of the extension's adapters.
function expected(platform, p) {
  if (platform === "instagram") {
    const type = p.kind < 0.45 ? "reel" : p.kind < 0.8 ? "photo" : "carousel";
    const code = "C" + String(p.i).padStart(4, "0");
    return { url: `https://www.instagram.com/${type === "reel" ? "reel" : "p"}/${code}/`, type, views: type === "reel" ? p.views : null, likes: p.likes, comments: p.comments };
  }
  if (platform === "tiktok") {
    const type = p.kind < 0.8 ? "video" : "carousel";
    const id = String(7300000000000000000n + BigInt(p.i));
    return { url: `https://www.tiktok.com/@creador/${type === "video" ? "video" : "photo"}/${id}`, type, views: p.views, likes: p.likes, comments: p.comments };
  }
  if (platform === "x") {
    const type = p.kind < 0.4 ? "text" : p.kind < 0.75 ? "photo" : "video";
    return { url: `https://x.com/pepe/status/${1800000000000000000n + BigInt(p.i)}`, type, views: p.i % 9 === 4 ? null : p.views, likes: p.likes, comments: p.comments };
  }
  const type = p.kind < 0.5 ? "video" : p.kind < 0.8 ? "photo" : "text";
  return { url: `https://www.facebook.com/juan/posts/pfbid0${p.i}`, type, views: type === "video" ? p.views : null, likes: p.likes, comments: p.comments };
}

// The files a download should fetch for a post (best quality, every carousel item).
function expectedMedia(platform, p) {
  const e = expected(platform, p);
  if (platform === "instagram") {
    const code = e.url.split("/")[4];
    const base = `https://${thumbHost.instagram}/v/${code}`;
    return e.type === "reel" ? [`${base}_720.mp4`] : e.type === "carousel" ? [`${base}_1080.jpg`, `${base}_c2.mp4`] : [`${base}_1080.jpg`];
  }
  if (platform === "tiktok") {
    const id = e.url.split("/").pop();
    if (e.type !== "video") return [1, 2].map((k) => `https://${thumbHost.tiktok}/obj/${id}_${k}.jpeg`);
    return [p.i % 2 === 0 ? `https://v19-webapp-prime.tiktok.com/video/tos/${id}/?mime_type=video_mp4&alt=1` : `https://v16-webapp-prime.tiktok.com/video/tos/${id}/?mime_type=video_mp4`];
  }
  if (platform === "x") {
    const id = e.url.split("/").pop();
    return e.type === "video" ? [`https://video.twimg.com/ext_tw_video/${id}/high.mp4?tag=12`] : e.type === "photo" ? [`https://${thumbHost.x}/media/${id}.jpg?name=orig`] : [];
  }
  const pid = String(5000 + p.i);
  return e.type === "video" ? [`https://video.xx.fbcdn.net/v/${pid}_hd.mp4?x=1`] : e.type === "photo" ? [`https://${thumbHost.facebook}/v/${pid}.jpg`] : [];
}

// Platform-shaped JSON for one page of posts.
function igNode(p) {
  const e = expected("instagram", p);
  const code = e.url.split("/")[4];
  const node = {
    code, pk: String(3000 + p.i), id: `${3000 + p.i}_1`, taken_at: p.date,
    media_type: e.type === "reel" ? 2 : e.type === "carousel" ? 8 : 1,
    product_type: e.type === "reel" ? "clips" : e.type === "carousel" ? "carousel_container" : "feed",
    like_count: p.likes, comment_count: p.comments, play_count: e.type === "reel" ? p.views : null,
    caption: { text: p.text }, user: { username: "prueba" },
  };
  const img = { candidates: [{ url: `https://${thumbHost.instagram}/v/${code}.jpg`, width: 320, height: 400 }, { url: `https://${thumbHost.instagram}/v/${code}_1080.jpg`, width: 1080, height: 1350 }] };
  if (e.type === "carousel") {
    node.carousel_media = [
      { pk: "1", media_type: 1, image_versions2: img },
      { pk: "2", media_type: 2, image_versions2: img, video_versions: [{ width: 720, height: 1280, url: `https://${thumbHost.instagram}/v/${code}_c2.mp4` }] },
    ];
  } else node.image_versions2 = img;
  if (e.type === "reel") node.video_versions = [{ width: 480, height: 854, url: `https://${thumbHost.instagram}/v/${code}_480.mp4` }, { width: 720, height: 1280, url: `https://${thumbHost.instagram}/v/${code}_720.mp4` }];
  return { node };
}
// The trimmed version the profile's reels tab sends: no date, author, caption, video or carousel items.
function igTrimmed(p) {
  const n = igNode(p).node;
  const t = { pk: n.pk, id: n.id, code: n.code, media_type: n.media_type, product_type: n.product_type, like_count: n.like_count, comment_count: n.comment_count, play_count: n.play_count, like_and_view_counts_disabled: false };
  t.image_versions2 = n.image_versions2 || n.carousel_media[0].image_versions2;
  return t;
}
// Reels from other accounts that Instagram loads in the background (huge counts: they would be #1 if counted).
function igForeign() {
  return Array.from({ length: 4 }, (_, k) => ({
    node: { media: { code: "OTRA" + k + "xyz", pk: String(900 + k), id: `${900 + k}_7`, taken_at: Math.floor(NOW / 1000) - 3600, media_type: 2, product_type: "clips", like_count: 9e8, comment_count: 9e6, user: { username: "otra_cuenta" }, image_versions2: { candidates: [{ url: `https://${thumbHost.instagram}/v/otra${k}.jpg`, width: 360, height: 640 }] } } },
  }));
}
function fakeReel(code, pk, views) {
  return { pk: String(pk), id: pk + "_1", code, media_type: 2, product_type: "clips", like_count: 10, comment_count: 1, play_count: views || 1000, image_versions2: { candidates: [{ url: `https://${thumbHost.instagram}/v/${code}.jpg`, width: 320, height: 400 }] } };
}
// A profile whose page keeps receiving posts (with no author) in the background, never grows and
// never says "no more pages": what made the loader spin forever.
function infiniteHtml() {
  const first = { data: { xdt_api__v1__clips__user__connection_v2: { edges: Array.from({ length: 12 }, (_, k) => ({ node: { media: fakeReel("INF" + k + "abc", 800000 + k, 2000 + k) } })), page_info: { has_next_page: true } } } };
  return `<!doctype html><html><head><meta charset="utf-8"><title>infinito</title></head><body style="margin:0;background:#000;color:#eee">
<script type="application/json" data-sjs>${JSON.stringify(first)}</script><div style="height:2500px">perfil</div>
<script>window.__bgPosts = 0; let k = 0; setInterval(() => fetch('/graphql/query', { method: 'POST', body: 'bg=' + (k++) }).then(r => r.json()).then(() => { window.__bgPosts += 2; }), 400);</script>
</body></html>`;
}
function ttItem(p) {
  const e = expected("tiktok", p);
  const id = e.url.split("/").pop();
  const it = {
    id, desc: p.text, createTime: p.date, author: { uniqueId: "creador" },
    stats: { playCount: p.views, diggCount: p.likes, commentCount: p.comments, shareCount: p.shares, collectCount: 3 },
  };
  if (e.type === "video") {
    it.video = {
      cover: `https://${thumbHost.tiktok}/obj/${id}.jpeg`,
      playAddr: `https://v16-webapp-prime.tiktok.com/video/tos/${id}/?mime_type=video_mp4`,
      bitrateInfo: [{ CodecType: "h264", Bitrate: 900000, PlayAddr: { UrlList: [`https://v19-webapp-prime.tiktok.com/video/tos/${id}/?mime_type=video_mp4&alt=1`] } }],
      downloadAddr: `https://v16-webapp-prime.tiktok.com/video/tos/${id}/?mime_type=video_mp4&watermark=1`,
    };
  }
  else it.imagePost = { images: [1, 2].map((k) => ({ imageURL: { urlList: [`https://${thumbHost.tiktok}/obj/${id}_${k}.jpeg`] } })) };
  return it;
}
function xEntry(p) {
  const e = expected("x", p);
  const id = e.url.split("/").pop();
  const legacy = {
    full_text: p.text, created_at: new Date(p.date * 1000).toUTCString().replace(/^(\w+), (\d+) (\w+) (\d+) ([\d:]+) GMT$/, "$1 $3 $2 $5 +0000 $4"),
    favorite_count: p.likes, reply_count: p.comments, retweet_count: p.shares, quote_count: 0, bookmark_count: 1, entities: {},
  };
  const xthumb = `https://${thumbHost.x}/media/${id}.jpg`;
  const variants = [
    { content_type: "application/x-mpegURL", url: `https://video.twimg.com/${id}.m3u8` },
    { bitrate: 632000, content_type: "video/mp4", url: `https://video.twimg.com/ext_tw_video/${id}/low.mp4?tag=12` },
    { bitrate: 2176000, content_type: "video/mp4", url: `https://video.twimg.com/ext_tw_video/${id}/high.mp4?tag=12` },
  ];
  if (e.type !== "text") legacy.extended_entities = { media: [e.type === "video" ? { type: "video", media_url_https: xthumb, video_info: { variants } } : { type: "photo", media_url_https: xthumb }] };
  const tweet = { __typename: "Tweet", rest_id: id, core: { user_results: { result: { rest_id: "u1", core: { screen_name: "pepe" }, legacy: { screen_name: "pepe", favourites_count: 3, created_at: "Mon Jan 01 00:00:00 +0000 2018" } } } }, legacy };
  if (e.views != null) tweet.views = { count: String(p.views), state: "EnabledWithCount" };
  return { entryId: "tweet-" + id, content: { itemContent: { tweet_results: { result: tweet } } } };
}
function fbLines(page) {
  const lines = [];
  const edges = [];
  const deferred = [];
  for (const p of page) {
    const e = expected("facebook", p);
    const pid = String(5000 + p.i);
    const media =
      e.type === "video"
        ? { __typename: "Video", id: "v" + p.i, play_count: p.views, playable_url: `https://video.xx.fbcdn.net/v/${pid}_sd.mp4?x=1`, playable_url_quality_hd: `https://video.xx.fbcdn.net/v/${pid}_hd.mp4?x=1`, preferred_thumbnail: { image: { uri: `https://${thumbHost.facebook}/v/${pid}.jpg` } } }
        : e.type === "photo"
          ? { __typename: "Photo", photo_image: { uri: `https://${thumbHost.facebook}/v/${pid}.jpg` } }
          : null;
    const feedback = { __typename: "Feedback", id: Buffer.from("feedback:" + pid).toString("base64"), reaction_count: { count: p.likes }, share_count: { count: p.shares }, comment_rendering_instance: { comments: { total_count: p.comments } } };
    const story = {
      __typename: "Story", id: "S" + pid, post_id: pid,
      comet_sections: {
        content: { story: { message: { text: p.text }, attachments: media ? [{ styles: { attachment: { media } } }] : [] } },
        context_layout: { story: { comet_sections: { actor_photo: { story: { actors: [{ name: "Juan" }] } }, metadata: [{ story: { creation_time: p.date, url: e.url } }] } } },
      },
    };
    // Half of the posts get their counts in a separate (deferred) chunk, like Facebook's streamed responses.
    if (p.i % 2 === 0) story.comet_sections.feedback = { story: { feedback } };
    else deferred.push({ label: "feed$defer$ufi", path: ["node", "edges", edges.length], data: { __typename: "Story", id: "S" + pid, comet_sections: { feedback: { story: { feedback } } } } });
    edges.push({ node: story });
  }
  lines.push({ data: { node: { timeline_list_feed_units: { edges } } } });
  for (const d of deferred) lines.push(d);
  return lines.map((l) => JSON.stringify(l)).join("\r\n");
}

function pageBody(platform, posts, n) {
  const page = posts.slice(n * PER_PAGE, (n + 1) * PER_PAGE);
  const hasMore = n + 1 < PAGES;
  if (platform === "instagram") {
    // Odd pages come in the reels tab's trimmed shape.
    if (n % 2) return JSON.stringify({ data: { xdt_api__v1__clips__user__connection_v2: { edges: page.map((p) => ({ node: { media: igTrimmed(p) } })), page_info: { has_next_page: hasMore } } }, status: "ok" });
    return JSON.stringify({ data: { xdt_api__v1__feed__user_timeline_graphql_connection: { edges: page.map(igNode), page_info: { has_next_page: hasMore } } }, status: "ok" });
  }
  if (platform === "tiktok") return JSON.stringify({ itemList: page.map(ttItem), cursor: String(n + 1), hasMore });
  if (platform === "x") return JSON.stringify({ data: { user: { result: { timeline: { timeline: { instructions: [{ type: "TimelineAddEntries", entries: page.map(xEntry) }] } } } } } });
  return fbLines(page);
}

// The fake page: its own script requests the next page when scrolled near the bottom.
const REQUEST_JS = {
  instagram: `fetch('/graphql/query', {method:'POST', body:'doc_id=1&page='+page}).then(r => r.json())`,
  tiktok: `new Promise((ok) => { const x = new XMLHttpRequest(); x.open('GET', '/api/post/item_list/?cursor=' + page); x.onload = () => ok(JSON.parse(x.responseText)); x.send(); })`,
  x: `new Promise((ok) => { const x = new XMLHttpRequest(); x.responseType = 'json'; x.open('GET', '/i/api/graphql/abc123/UserTweets?page=' + page); x.onload = () => ok(x.response); x.send(); })`,
  facebook: `new Promise((ok) => { const x = new XMLHttpRequest(); x.open('POST', '/api/graphql/'); x.onload = () => ok(x.responseText.length); x.send('page=' + page); })`,
};
function html(platform, posts) {
  // Instagram's first page is embedded in the HTML (server-rendered JSON), the rest are fetched.
  const ssr =
    platform === "instagram"
      ? `<script type="application/json" data-sjs>${JSON.stringify({ require: [["ScheduledServerJS", "handle", null, [{ __bbox: { require: [["RelayPrefetchedStreamCache", "next", [], ["k", { __bbox: { complete: true, result: JSON.parse(pageBody("instagram", posts, 0)) } }]]] } }]]] }).replace(/</g, "\\u003c")}</script>` +
        `<script type="application/json" data-sjs>${JSON.stringify({ require: [["RelayPrefetchedStreamCache", "next", [], ["r", { __bbox: { result: { data: { xdt_api__v1__clips__home__connection_v2: { edges: igForeign() } } } } }]]] })}</script>`
      : "";
  const start = platform === "instagram" ? 1 : 0;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Prueba ${platform}</title></head>
<body style="margin:0;font:16px sans-serif;${platform === "instagram" ? "background:#000;color:#f5f5f5" : "background:#fafafa"}">${ssr}
<h1 style="padding:20px">Página de prueba que imita ${platform}</h1><div id="feed"></div>
<script>
  let page = ${start}; let loading = false; window.__pagesLoaded = ${start}; window.__pageErrors = 0;
  function grow(label) { const d = document.createElement('div'); d.style.cssText = 'height:1400px;border-top:1px solid #ddd;padding:20px'; d.textContent = label; document.getElementById('feed').appendChild(d); }
  grow('bloque inicial');
  function loadMore() {
    if (loading || page >= ${PAGES}) return;
    loading = true;
    ${REQUEST_JS[platform]}.then((data) => { if (!data) window.__pageErrors++; page++; window.__pagesLoaded = page; grow('bloque ' + page); loading = false; },
      () => { window.__pageErrors++; loading = false; });
  }
  addEventListener('scroll', () => { if (innerHeight + scrollY > document.body.scrollHeight - 900) loadMore(); });
  ${start === 0 ? "loadMore();" : ""}
</script></body></html>`;
}

function thumbSvg(label) {
  let hsh = 0;
  for (const c of label) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
  const hue = hsh % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,62%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360},70%,42%)"/></linearGradient></defs><rect width="400" height="500" fill="url(#g)"/><circle cx="300" cy="120" r="60" fill="rgba(255,255,255,.25)"/><rect x="40" y="330" width="250" height="26" rx="13" fill="rgba(255,255,255,.55)"/><rect x="40" y="374" width="170" height="26" rx="13" fill="rgba(255,255,255,.35)"/></svg>`;
}

// ---------- the test ----------
// Each platform exercises a different popup filter and sort.
const PLATFORMS = [
  { id: "instagram", url: "https://www.instagram.com/prueba/", filter: { mode: "posts", value: "0" }, sort: "views", resort: "likes", typeFilter: "reel", pages: PAGES, title: "Publicaciones más vistas" },
  { id: "tiktok", url: "https://www.tiktok.com/@creador", filter: { mode: "posts", value: "50" }, sort: "comments", resort: "views", typeFilter: "carousel", pages: 5, title: "Videos con más comentarios" },
  { id: "x", url: "https://x.com/pepe", filter: { mode: "date", value: "3m" }, sort: "likes", resort: "oldest", typeFilter: "video", pages: 3, title: "Posts con más likes" },
  { id: "facebook", url: "https://www.facebook.com/juan", filter: { mode: "posts", value: "0" }, sort: "outlier", resort: "comments", typeFilter: "video", pages: PAGES, title: "Publicaciones con mayor outlier score" },
];
if (process.env.ONLY) PLATFORMS.splice(0, PLATFORMS.length, ...PLATFORMS.filter((p) => p.id === process.env.ONLY));
const FIELD = { views: "views", likes: "likes", comments: "comments", outlier: "outlier", oldest: "date" };

// Independent re-implementation of the expected ordering.
function sortExpected(list, key) {
  const f = FIELD[key];
  const asc = key === "oldest";
  return list
    .slice()
    .sort((a, b) => {
      const va = a[f];
      const vb = b[f];
      if (va == null && vb == null) return a.seq - b.seq;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (asc ? va - vb : vb - va) || a.seq - b.seq;
    })
    .map((e) => e.url);
}
function withOutliers(list) {
  const med = (xs) => {
    const s = xs.filter((v) => v > 0).sort((a, b) => a - b);
    if (!s.length) return null;
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const mv = med(list.map((e) => e.views ?? 0));
  const ml = med(list.map((e) => e.likes ?? 0));
  return list.map((e) => ({ ...e, outlier: e.views != null && mv ? e.views / mv : e.likes != null && ml ? e.likes / ml : null }));
}

const inShadow = (page, js, arg) =>
  page.evaluate(({ js, arg }) => new Function("root", "arg", js)(document.querySelector("#valkiria-root").shadowRoot, arg), { js, arg });
const tileHrefs = (page) => inShadow(page, `return [...root.querySelectorAll('.results .tile')].map(a => a.getAttribute('href'))`);
const text = (page, sel) => inShadow(page, `return root.querySelector(arg)?.textContent ?? null`, sel);
const R = (sel) => `#valkiria-root ${sel}`;

const EXT_ID = [...createHash("sha256").update(EXT).digest("hex").slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
const POPUP = `chrome-extension://${EXT_ID}/src/popup/popup.html?pick=any`;

// chrome.downloads requests don't go through Playwright's routes, so the CDN hosts are mapped to a
// local HTTPS server (self-signed certificate). Needs openssl; without it the download checks are skipped.
const served = [];
const infoCalls = [];
const refused = [];
let cdnPort = null;
const DL_DIR = mkdtempSync(path.join(os.tmpdir(), "valkiria-dl-"));
try {
  const certDir = mkdtempSync(path.join(os.tmpdir(), "valkiria-tls-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", path.join(certDir, "k.pem"), "-out", path.join(certDir, "c.pem"), "-days", "2", "-subj", "/CN=localhost"], { stdio: "ignore" });
  const server = https.createServer({ key: readFileSync(path.join(certDir, "k.pem")), cert: readFileSync(path.join(certDir, "c.pem")) }, (req, res) => {
    const url = "https://" + req.headers.host + req.url;
    const host = String(req.headers.host).split(":")[0];
    // Like TikTok: its video files need the tt_chain_token cookie and a tiktok.com Referer.
    let ok = true;
    // (tiktokcdn.com can only check the Referer: a tiktok.com cookie is never sent there.)
    if (/(^|\.)(tiktok|tiktokcdn)\.com$/.test(host)) {
      const referer = /^https:\/\/www\.tiktok\.com\//.test(req.headers.referer || "");
      ok = referer && (host.endsWith("tiktokcdn.com") || /tt_chain_token=OK/.test(req.headers.cookie || ""));
      const m = /\/video\/tos\/(\d+)\/\?mime_type=video_mp4$/.exec(req.url); // main URL of even posts: expired
      if (m && host.startsWith("v16-") && (BigInt(m[1]) - 7300000000000000000n) % 2n === 0n) ok = false;
    }
    (ok ? served : refused).push(url + (ok ? "" : `  [cookie=${req.headers.cookie || "-"} referer=${req.headers.referer || "-"}]`));
    res.writeHead(ok ? 200 : 403, { "content-type": ok ? (/\.mp4|mime_type=video/.test(req.url) ? "video/mp4" : "image/jpeg") : "text/plain" });
    res.end(ok ? "fake media " + req.url : "forbidden");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  server.unref();
  cdnPort = server.address().port;
} catch (e) {
  console.log("(openssl not available: skipping download checks)");
}

const context = await chromium.launchPersistentContext("", {
  channel: "chromium",
  headless: true,
  viewport: { width: 1360, height: 900 },
  deviceScaleFactor: SHOTS ? 2 : 1,
  acceptDownloads: true,
  downloadsPath: DL_DIR,
  args: [
    ...(process.env.FODEBUG ? ["--enable-logging=stderr", "--v=0"] : []),
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    // Only the media CDNs go to the local server (not Chromium's own background requests).
    ...(cdnPort
      ? [`--host-resolver-rules=${["*.cdninstagram.com", "*.tiktok.com", "*.tiktokcdn.com", "*.twimg.com", "*.fbcdn.net"].map((h) => `MAP ${h} 127.0.0.1:${cdnPort}`).join(", ")}`, "--ignore-certificate-errors", "--no-proxy-server"]
      : []),
  ],
});

const data = Object.fromEntries(PLATFORMS.map((p) => [p.id, makeData(p.id)]));
// The cookie TikTok sets for its video servers (SameSite=Lax: the strictest plausible setting).
await context.addCookies([{ name: "tt_chain_token", value: "OK", domain: ".tiktok.com", path: "/", secure: true, sameSite: "Lax" }]);
await context.route("**/*", async (route) => {
  const req = route.request();
  const u = new URL(req.url());
  if (u.protocol === "chrome-extension:") return route.continue();
  const platform = PLATFORMS.find((p) => new URL(p.url).hostname === u.hostname);
  if (Object.values(thumbHost).includes(u.hostname)) return route.fulfill({ contentType: "image/svg+xml", body: thumbSvg(u.pathname) });
  if (!platform) return route.fulfill({ status: 404, body: "" });
  const posts = data[platform.id];
  // Scenario pages.
  if (platform.id === "instagram" && u.pathname === "/infinito/" && req.resourceType() === "document") return route.fulfill({ contentType: "text/html; charset=utf-8", body: infiniteHtml() });
  const bg = /(?:^|&)bg=(\d+)/.exec(req.postData() || "");
  if (platform.id === "instagram" && bg) return route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: { xdt_api__v1__clips__user__connection_v2: { edges: [0, 1].map((k) => ({ node: { media: fakeReel("BG" + bg[1] + "x" + k, 500000 + Number(bg[1]) * 2 + k) } })), page_info: { has_next_page: true } } } }) });
  if (platform.id === "tiktok" && (req.frame()?.url() || "").includes("@limitado") && /cursor=\d/.test(u.search)) {
    // First page fine (posts by @limitado), then TikTok asks to slow down.
    if (/cursor=0(&|$)/.test(u.search)) return route.fulfill({ contentType: "application/json", body: JSON.stringify({ itemList: posts.slice(0, PER_PAGE).map((p) => ({ ...ttItem(p), author: { uniqueId: "limitado" } })), hasMore: true }) });
    return route.fulfill({ status: 429, contentType: "application/json", body: '{"statusCode":10000,"statusMsg":"too many requests"}' });
  }
  if (req.resourceType() === "document") return route.fulfill({ contentType: "text/html; charset=utf-8", body: html(platform.id, posts) });
  // Instagram's "full post" API, used to download trimmed posts.
  const info = platform.id === "instagram" && /^\/api\/v1\/media\/(\d+)\/info\/$/.exec(u.pathname);
  if (info) {
    const p = posts.find((x) => String(3000 + x.i) === info[1]);
    infoCalls.push(info[1]);
    if (!p || req.headers()["x-ig-app-id"] !== "936619743392459") return route.fulfill({ status: 400, body: "{}" });
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ items: [igNode(p).node], num_results: 1, status: "ok" }) });
  }
  const m = /(?:page|cursor)=(\d+)/.exec(u.search + "&" + (req.postData() || ""));
  if (!m) return route.fulfill({ status: 404, body: "" });
  return route.fulfill({ contentType: "application/json", body: pageBody(platform.id, posts, Number(m[1])) });
});

async function downloadFrom(page, rowLabel, buttonTitle) {
  await page.locator(R(".head .menuwrap > button.outline")).click();
  const [dl] = await Promise.all([
    page.waitForEvent("download"),
    page.locator(R(`.menu .mi:has-text("${rowLabel}") button[title="${buttonTitle}"]`)).click(),
  ]);
  return { name: dl.suggestedFilename(), bytes: readFileSync(await dl.path()) };
}

async function downloadAndCheck(page, posts, label) {
  const want = posts.flatMap((e) => e.media);
  if (!cdnPort || !want.length) return;
  served.length = 0;
  refused.length = 0;
  infoCalls.length = 0;
  const before = readdirSync(DL_DIR).length;
  await page.locator(R(".head button:has-text('Descargar')")).click();
  await page.waitForFunction(() => /^(Listo|Cancelado)/.test(document.querySelector("#valkiria-root").shadowRoot.querySelector(".dl.on .msg")?.textContent || ""), null, { timeout: 30000 });
  const msg = await text(page, ".dl .msg");
  const noFile = posts.filter((e) => !e.media.length).length;
  assert.ok(msg.startsWith(`Listo: ${want.length} de ${want.length} archivos${noFile ? ` · ${noFile} sin archivo` : ""}`), label + ": " + msg + "\n  refused:\n    " + refused.join("\n    ") + "\n  served:\n    " + served.join("\n    "));
  assert.deepEqual(served.slice().sort(), want.slice().sort(), label + ": files fetched");
  assert.equal(readdirSync(DL_DIR).length - before, want.length, label + ": files saved");
  console.log(`     ${label}: ${want.length} files downloaded (${posts.length} posts${noFile ? `, ${noFile} without media` : ""})${refused.length ? ` · ${refused.length} refused first, recovered` : ""}${infoCalls.length ? ` · ${infoCalls.length} trimmed posts completed via the post API` : ""}`);
  if (SHOTS && label === "download top") await page.screenshot({ path: path.join(SHOTS, "download.png") });
  await page.locator(R(".dl button")).click(); // close the notice
}

let failures = 0;
for (const P of PLATFORMS) {
  const t0 = Date.now();
  let page = null;
  let popup = null;
  try {
    page = await context.newPage();
    await page.goto(P.url);
    await page.waitForFunction(() => document.querySelector("#valkiria-root")?.shadowRoot);

    // ---- popup ----
    popup = await context.newPage();
    await popup.setViewportSize({ width: 300, height: 640 });
    await popup.goto(POPUP);
    await popup.waitForFunction((name) => document.getElementById("where").textContent.startsWith(name), { instagram: "Instagram", tiktok: "TikTok", x: "X", facebook: "Facebook" }[P.id]);
    await popup.locator(P.filter.mode === "posts" ? "#modePosts" : "#modeDate").click();
    await popup.locator(P.filter.mode === "posts" ? "#postsSel" : "#dateSel").selectOption(P.filter.value);
    if (SHOTS && P.id === "instagram") await popup.screenshot({ path: path.join(SHOTS, "popup.png"), fullPage: true });
    await popup.locator(`#sorts button[data-sort="${P.sort}"]`).click();
    await page.bringToFront();

    // ---- loading veil + toast ----
    await page.waitForFunction(() => document.querySelector("#valkiria-root").shadowRoot.querySelector(".toast.on"), null, { timeout: 5000 });
    if (SHOTS && P.id === "instagram") {
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(SHOTS, "loading.png") });
    }
    await page.waitForFunction(() => document.querySelector("#valkiria-root").shadowRoot.querySelector(".results.on"), null, { timeout: 90000 });
    const pageState = await page.evaluate(() => ({ loaded: window.__pagesLoaded, errors: window.__pageErrors }));
    assert.equal(pageState.errors, 0, "the site's own requests got valid data");
    assert.equal(pageState.loaded, P.pages, "pages the loader made the site request");

    // ---- expected list ----
    let exp = data[P.id].map((p, seq) => ({ ...expected(P.id, p), date: p.date * 1000, seq, media: expectedMedia(P.id, p) }));
    exp = exp.slice(0, P.pages * PER_PAGE); // what was loaded
    if (P.filter.mode === "posts" && P.filter.value !== "0") exp = exp.slice(0, Number(P.filter.value));
    if (P.filter.mode === "date") exp = exp.filter((e) => e.date >= NOW - 91 * DAY);
    exp = withOutliers(exp); // the baseline is every post in the chosen set

    assert.equal(await text(page, ".head h1"), P.title);
    assert.equal(await text(page, ".head .sub"), `Mostrando ${exp.length} ${{ instagram: "publicaciones", tiktok: "videos", x: "posts", facebook: "publicaciones" }[P.id]}`);
    assert.deepEqual(await tileHrefs(page), sortExpected(exp, P.sort), "sorted by " + P.sort);

    // Popup now reports the results and offers to reopen them.
    await popup.waitForFunction(() => !document.getElementById("show").hidden);

    // The diagnostic has counts and field names only, never content.
    if (P.id === "instagram") {
      const d = JSON.parse(
        await popup.evaluate(async () => {
          for (const t of await chrome.tabs.query({})) {
            const r = await chrome.tabs.sendMessage(t.id, { type: "fo:diag" }).catch(() => null);
            if (r && r.ok) return r.text;
          }
        })
      );
      if (process.env.DUMPDIAG) (await import("node:fs")).writeFileSync(process.env.DUMPDIAG, JSON.stringify(d, null, 1));
      assert.equal(d.posts, exp.length, "diagnostic: posts");
      assert.equal(d.otherAccounts, 4, "diagnostic: recommended reels from other accounts set apart");
      assert.ok(d.responses.length >= PAGES, "diagnostic: responses");
      assert.equal(d.lastLoad.reason, "end-signal", "stopped because Instagram said there were no more pages");
      const raw = JSON.stringify(d);
      for (const leak of ["otra_cuenta", "receta", "cdninstagram", "prueba/"]) assert.ok(!raw.includes(leak), "diagnostic leaks " + leak);
    }

    // ---- re-sort and filter inside the results ----
    await page.locator(R(".tools select")).selectOption(P.resort);
    await page.waitForTimeout(50);
    assert.deepEqual(await tileHrefs(page), sortExpected(exp, P.resort), "re-sorted by " + P.resort);
    await page.locator(R(".tools > button:first-child")).click(); // "Filtros"
    await page.locator(R('.filters select[aria-label="Tipo"]')).selectOption(P.typeFilter);
    const filtered = exp.filter((e) => e.type === P.typeFilter);
    assert.deepEqual(await tileHrefs(page), sortExpected(filtered, P.resort), "type filter " + P.typeFilter);

    // ---- table and summary views ----
    if (P.id === "instagram") {
      await page.locator(R('.views button:has-text("Tabla")')).click();
      const rows = await inShadow(page, `return root.querySelectorAll('.tablewrap tbody tr').length`);
      assert.equal(rows, filtered.length, "table rows");
      await page.locator(R('.views button:has-text("Resumen")')).click();
      const sum = await inShadow(page, `return { tiles: root.querySelectorAll('.summary .stat').length, charts: root.querySelectorAll('.summary .chart').length, svgs: root.querySelectorAll('.summary svg').length }`);
      assert.equal(sum.tiles, 5, "summary tiles");
      assert.ok(sum.charts >= 3 && sum.svgs >= 3, "summary charts " + JSON.stringify(sum));
      if (SHOTS) {
        await page.locator(R('.filters select[aria-label="Tipo"]')).selectOption("all");
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(SHOTS, "summary.png"), fullPage: false });
        await page.locator(R('.filters select[aria-label="Tipo"]')).selectOption(P.typeFilter);
      }
      await page.locator(R('.views button:has-text("Grilla")')).click();
    }
    if (P.id === "tiktok") {
      await page.locator(R(".tools select")).selectOption("velocity");
      const now = Date.now();
      const vel = filtered.map((e) => ({ ...e, velocity: e.views == null ? null : e.views / Math.max(1, (now - e.date) / DAY) }));
      FIELD.velocity = "velocity";
      assert.deepEqual(await tileHrefs(page), sortExpected(vel, "velocity"), "sorted by views per day");
      await page.locator(R(".tools select")).selectOption(P.resort);
    }

    // ---- export (all filtered) ----
    const csv = await downloadFrom(page, "CSV", "Descargar .csv");
    const rows = csv.bytes.toString("utf8").replace(/\r\n$/, "").split("\r\n");
    assert.equal(rows.length, filtered.length + 1, "CSV rows");
    assert.ok(rows[0].startsWith("\uFEFFplataforma;url;"), "CSV header");
    assert.ok(rows[1].includes(sortExpected(filtered, P.resort)[0]), "CSV keeps the order");
    if (P.id === "instagram") {
      const x = await downloadFrom(page, "Excel", "Descargar .xlsx");
      assert.ok(x.name.endsWith(".xlsx") && x.bytes.subarray(0, 2).toString() === "PK", "xlsx download");
      const j = await downloadFrom(page, "JSON", "Descargar .json");
      assert.equal(JSON.parse(j.bytes.toString("utf8")).length, filtered.length, "json rows");
    }

    // ---- select mode: export only the chosen posts ----
    await page.locator(R(".tools button:has-text('Limpiar filtros')")).click();
    await page.locator(R(".tools button:has-text('Seleccionar')")).click();
    const tiles = page.locator(R(".results .tile"));
    for (const i of [0, 2, 3]) await tiles.nth(i).click();
    assert.equal((await text(page, ".head .menuwrap > button.outline")).replace(/\s+/g, " ").trim(), "Exportar3");
    if (SHOTS && P.id === "tiktok") await page.screenshot({ path: path.join(SHOTS, "select.png") });
    const sel = await downloadFrom(page, "CSV", "Descargar .csv");
    const selRows = sel.bytes.toString("utf8").replace(/\r\n$/, "").split("\r\n");
    const order = sortExpected(exp, P.resort);
    assert.deepEqual(selRows.slice(1).map((r) => r.split(";")[1]), [order[0], order[2], order[3]], "selected rows exported");
    const byUrl = new Map(exp.map((e) => [e.url, e]));
    await downloadAndCheck(page, [order[0], order[2], order[3]].map((u) => byUrl.get(u)), "download selected");
    if (P.id === "instagram") {
      await page.locator(R('.head button:has-text("Guardar")')).click();
      await page.locator(R('.savebox input')).fill("Mis ideas");
      await page.locator(R('.savebox button:has-text("Crear")')).click();
      await page.waitForFunction(() => /3 publicaciones guardadas en «Mis ideas»/.test(document.querySelector("#valkiria-root").shadowRoot.querySelector(".note").textContent));
    }
    await page.locator(R(".head button:has-text('Cancelar')")).click();
    if (P.id === "instagram" || P.id === "tiktok") await downloadAndCheck(page, order.slice(0, 100).map((u) => byUrl.get(u)), "download top");

    if (SHOTS) {
      await page.locator(R(".tools select")).selectOption(P.sort);
      await inShadow(page, `root.querySelector('.results').scrollTop = 0`);
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SHOTS, `results-${P.id}.png`) });
    }

    // ---- back to the page, reopen from the popup without reloading ----
    await page.locator(R(".topbar > button")).click();
    assert.equal(await inShadow(page, `return !!root.querySelector('.results.on')`), false, "results closed");
    await popup.locator("#show").click();
    await page.waitForFunction(() => document.querySelector("#valkiria-root").shadowRoot.querySelector(".results.on"));
    // Choosing another sort for the same page re-uses the loaded posts (no new requests).
    await popup.locator(`#sorts button[data-sort="${P.resort}"]`).click();
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.__pagesLoaded), P.pages, "no reload for a new sort");
    assert.deepEqual(await tileHrefs(page), sortExpected(exp, P.resort), "sorted again from the popup");

    console.log(`ok   ${P.id.padEnd(9)} ${exp.length} posts · ${P.pages} pages · sort/re-sort/filter/export/select ok (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  } catch (e) {
    failures++;
    console.log(`FAIL ${P.id}: ${e.message.split("\n").slice(0, 8).join("\n")}`);
  } finally {
    await popup?.close();
    await page?.close();
  }
}

// ---------- extra scenarios ----------
async function scenario(name, fn) {
  const t0 = Date.now();
  const pages = [];
  try {
    await fn(pages);
    console.log(`ok   scenario: ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  } catch (e) {
    failures++;
    console.log(`FAIL scenario ${name}: ${e.message.split("\n").slice(0, 8).join("\n")}`);
  } finally {
    for (const p of pages) await p.close().catch(() => {});
  }
}
async function openPopup(pages) {
  const popup = await context.newPage();
  pages.push(popup);
  await popup.setViewportSize({ width: 300, height: 640 });
  await popup.goto(POPUP);
  await popup.waitForFunction(() => document.getElementById("where").textContent.length > 0);
  return popup;
}
const resultsOpen = (page, timeout) => page.waitForFunction(() => document.querySelector("#valkiria-root").shadowRoot.querySelector(".results.on"), null, { timeout: timeout || 60000 });

await scenario("endless background posts at the end of a profile (no 'no more pages' signal)", async (pages) => {
  const page = await context.newPage();
  pages.push(page);
  await page.goto("https://www.instagram.com/infinito/");
  const popup = await openPopup(pages);
  await popup.locator("#modePosts").click();
  await popup.locator("#postsSel").selectOption("0");
  await popup.locator('#sorts button[data-sort="views"]').click();
  await page.bringToFront();
  await resultsOpen(page, 60000); // used to keep "loading" forever
  assert.equal(await inShadow(page, `return !!root.querySelector('.toast.on')`), false, "loading notice closed");
  assert.ok(await page.evaluate(() => window.__bgPosts) >= 4, "the page kept sending posts in the background");
  assert.match(await text(page, ".statusline"), /dejó de mandar/);
});

await scenario("the site asks to wait (HTTP 429): pause and say so", async (pages) => {
  const page = await context.newPage();
  pages.push(page);
  await page.goto("https://www.tiktok.com/@limitado");
  const popup = await openPopup(pages);
  await popup.locator("#modePosts").click();
  await popup.locator("#postsSel").selectOption("0");
  await popup.locator('#sorts button[data-sort="views"]').click();
  await page.bringToFront();
  await resultsOpen(page, 20000);
  assert.match(await text(page, ".statusline"), /pidió esperar/);
  assert.equal(await inShadow(page, `return root.querySelectorAll('.results .tile').length`), 12, "what loaded before the limit is shown");
});

await scenario("a saved profile opens instantly; 'Actualizar datos' loads it again", async (pages) => {
  const page = await context.newPage();
  pages.push(page);
  await page.goto("https://www.instagram.com/prueba/");
  const popup = await openPopup(pages);
  await popup.waitForFunction(() => /Guardado .*72/.test(document.getElementById("status").textContent));
  const t0 = Date.now();
  await popup.locator('#sorts button[data-sort="likes"]').click();
  await page.bringToFront();
  await resultsOpen(page, 5000);
  assert.ok(Date.now() - t0 < 3000, "instant");
  assert.equal(await page.evaluate(() => window.__pagesLoaded), 1, "nothing requested from the network");
  assert.match(await text(page, ".statusline"), /Datos guardados/);
  assert.equal(await inShadow(page, `return root.querySelectorAll('.results .tile').length`), 72);
  await page.locator(R('.statusline button:has-text("Actualizar datos")')).click();
  await page.waitForFunction(() => document.querySelector("#valkiria-root").shadowRoot.querySelector(".toast.on"), null, { timeout: 5000 });
  await resultsOpen(page, 60000);
  assert.equal(await page.evaluate(() => window.__pagesLoaded), PAGES, "reloaded from the network");
  assert.match(await text(page, ".statusline"), /Cargado/);
});

await scenario("collections, saved profiles and comparison page", async (pages) => {
  const app = await context.newPage();
  pages.push(app);
  await app.goto(`chrome-extension://${EXT_ID}/src/app/app.html#colecciones`);
  await app.locator("text=Mis ideas").first().waitFor();
  await app.locator('#colecciones button:has-text("Ver")').first().click();
  assert.equal(await app.locator("#colecciones .post").count(), 3, "the 3 saved posts");
  await app.locator('nav button[data-tab="perfiles"]').click();
  assert.ok((await app.locator("#perfiles .item").count()) >= 5, "saved profiles listed");
  await app.locator('nav button[data-tab="comparar"]').click();
  await app.locator("#comparar table.t").waitFor();
  assert.equal(await app.locator("#comparar table.t thead th").count(), 3, "two profiles compared by default");
  assert.ok((await app.locator("#comparar .vrows").count()) >= 4, "comparison bars");
  if (SHOTS) {
    await app.setViewportSize({ width: 1200, height: 1000 });
    await app.screenshot({ path: path.join(SHOTS, "compare.png"), fullPage: true });
  }
});

await context.close();
console.log(failures ? `${failures} failed` : "all platforms passed");
process.exit(failures ? 1 : 0);
