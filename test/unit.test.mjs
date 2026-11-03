// Run with: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const ext = path.join(here, "..", "extension", "src");
const FILES = ["core/util.js", "core/extract.js", "platforms/instagram.js", "platforms/tiktok.js", "platforms/x.js", "platforms/facebook.js", "core/store.js", "core/export.js"];

function load() {
  const ctx = vm.createContext({ console, atob, URL, Date, Intl, Math, JSON, Blob, TextEncoder, DataView, ArrayBuffer, Uint8Array, Uint32Array });
  for (const f of FILES) vm.runInContext(readFileSync(path.join(ext, f), "utf8"), ctx, { filename: f });
  return ctx.FO;
}
const FO = load();
const plain = (v) => JSON.parse(JSON.stringify(v)); // cross-realm objects -> plain
const fixture = (n) => readFileSync(path.join(here, "fixtures", n), "utf8");
const extractText = (platform, text) => {
  const items = [];
  const partials = [];
  for (const doc of FO.util.parsePayload(text)) {
    const r = FO.extract(platform, doc);
    items.push(...r.items);
    partials.push(...r.partials);
  }
  return { items: plain(items), partials: plain(partials) };
};

test("toNum parses plain, compact and Spanish numbers", () => {
  const n = FO.util.toNum;
  assert.equal(n(1234), 1234);
  assert.equal(n("1234"), 1234);
  assert.equal(n("1.2M"), 1200000);
  assert.equal(n("1,2 M"), 1200000);
  assert.equal(n("12K"), 12000);
  assert.equal(n("3,4 mil"), 3400);
  assert.equal(n("2 millones"), 2000000);
  assert.equal(n("1,234 views"), 1234);
  assert.equal(n("1.234.567"), 1234567);
  assert.equal(n({ count: 5 }), 5);
  assert.equal(n(null), null);
  assert.equal(n("abc"), null);
});

test("toDate handles unix seconds, ms, numeric strings and X dates", () => {
  const d = FO.util.toDate;
  assert.equal(d(1730000000), 1730000000000);
  assert.equal(d("1730000000"), 1730000000000);
  assert.equal(d(1730000000123), 1730000000123);
  assert.equal(d("Wed Oct 30 15:04:05 +0000 2024"), Date.UTC(2024, 9, 30, 15, 4, 5));
  assert.equal(d(null), null);
});

test("safeUrl only accepts https on allowed hosts", () => {
  const s = FO.util.safeUrl;
  assert.equal(s("https://www.instagram.com/p/x/", ["instagram.com"]), "https://www.instagram.com/p/x/");
  assert.equal(s("javascript:alert(1)", ["instagram.com"]), null);
  assert.equal(s("https://evil.com/instagram.com", ["instagram.com"]), null);
  assert.equal(s("http://www.instagram.com/", ["instagram.com"]), null);
});

test("Instagram: modern timeline (reel, photo, carousel)", () => {
  const { items } = extractText("instagram", fixture("instagram_timeline.json"));
  assert.equal(items.length, 3);
  const [reel, photo, carousel] = items;
  assert.deepEqual(
    { id: reel.id, type: reel.type, url: reel.url, views: reel.views, likes: reel.likes, comments: reel.comments, author: reel.author },
    { id: "REEL1", type: "reel", url: "https://www.instagram.com/reel/REEL1/", views: 10000, likes: 500, comments: 20, author: "prueba" }
  );
  assert.equal(photo.type, "photo");
  assert.equal(photo.views, null);
  assert.equal(photo.url, "https://www.instagram.com/p/FOTO1/");
  assert.equal(carousel.type, "carousel");
  assert.equal(carousel.thumb, "https://scontent.cdninstagram.com/c1.jpg");
});

test("Instagram: legacy GraphQL shape", () => {
  const { items } = extractText("instagram", fixture("instagram_legacy.json"));
  assert.equal(items.length, 1);
  assert.deepEqual(
    { id: items[0].id, type: items[0].type, views: items[0].views, likes: items[0].likes, comments: items[0].comments, text: items[0].text },
    { id: "OLD1", type: "video", views: 3000, likes: 77, comments: 7, text: "viejo" }
  );
});

test("TikTok: item_list (video + photo post), ignores user stats", () => {
  const { items } = extractText("tiktok", fixture("tiktok_item_list.json"));
  assert.equal(items.length, 2);
  const [v, p] = items;
  assert.deepEqual(
    { views: v.views, likes: v.likes, comments: v.comments, shares: v.shares, saves: v.saves, type: v.type, url: v.url },
    { views: 5000, likes: 300, comments: 10, shares: 5, saves: 7, type: "video", url: "https://www.tiktok.com/@tester/video/7300000000000000001" }
  );
  assert.equal(p.type, "carousel");
  assert.equal(p.url, "https://www.tiktok.com/@tester/photo/7300000000000000002");
  assert.equal(p.date, 1730100000000);
  assert.equal(p.thumb, "https://p16-sign.tiktokcdn.com/p1.jpeg");
});

test("TikTok: server-rendered ItemModule with author as string", () => {
  const { items } = extractText("tiktok", fixture("tiktok_sigi.json"));
  assert.equal(items.length, 1);
  assert.equal(items[0].author, "tester");
  assert.equal(items[0].views, 42);
});

test("X: tweets, reposts keep the original, skips quoted and promoted", () => {
  const { items } = extractText("x", fixture("x_user_tweets.json"));
  const ids = items.map((i) => i.id);
  assert.deepEqual(ids, ["1", "3", "4"]);
  const [t1, t3, t4] = items;
  assert.deepEqual(
    { views: t1.views, likes: t1.likes, comments: t1.comments, shares: t1.shares, saves: t1.saves, type: t1.type, url: t1.url },
    { views: 1000, likes: 10, comments: 2, shares: 4, saves: 4, type: "photo", url: "https://x.com/pepe/status/1" }
  );
  assert.equal(t3.likes, 700);
  assert.equal(t4.type, "video");
  assert.equal(t1.date, Date.UTC(2024, 9, 30, 15, 4, 5));
});

test("Facebook: stories from multi-document response, deferred feedback merged, comments/shared ignored", () => {
  const { items, partials } = extractText("facebook", fixture("facebook_timeline.txt"));
  assert.deepEqual(items.map((i) => i.id), ["1001", "1002", "1003"]);
  const [s1, s2, s3] = items;
  assert.deepEqual(
    { likes: s1.likes, comments: s1.comments, shares: s1.shares, views: s1.views, type: s1.type, author: s1.author, text: s1.text },
    { likes: 250, comments: 30, shares: 12, views: null, type: "photo", author: "Juan", text: "post uno" }
  );
  assert.equal(s1.url, "https://www.facebook.com/juan/posts/pfbid0abc");
  assert.equal(s1.thumb, "https://scontent.xx.fbcdn.net/p1.jpg");
  assert.deepEqual(
    { likes: s2.likes, comments: s2.comments, views: s2.views, type: s2.type, text: s2.text },
    { likes: 90, comments: 6, views: 8000, type: "video", text: "video dos" }
  );
  assert.equal(s3.likes, null, "story 1003 has no counts of its own");
  assert.deepEqual(partials.map((p) => p.id), ["1003"], "comment feedback (1001_55) must be ignored");

  const store = new FO.Store();
  store.add([], [partials[0]], "juan"); // counts arrive before the post
  store.add(items, [], "juan");
  const merged = store.query({ ctx: "juan", sortKey: "likes" }).map((i) => [i.id, i.likes, i.comments]);
  assert.deepEqual(plain(merged), [["1001", 250, 30], ["1002", 90, 6], ["1003", 40, 4]]);
});

test("Facebook: standalone reel video nodes", () => {
  const { items } = extractText("facebook", fixture("facebook_reels.json"));
  assert.equal(items.length, 1);
  assert.deepEqual(
    { id: items[0].id, views: items[0].views, type: items[0].type, url: items[0].url },
    { id: "video:555", views: 12345, type: "reel", url: "https://www.facebook.com/reel/555/" }
  );
});

test("ctxKey groups profile, overlay and search pages", () => {
  const k = FO.ctxKey;
  assert.equal(k("instagram", "https://www.instagram.com/prueba/"), "prueba");
  assert.equal(k("instagram", "https://www.instagram.com/prueba/reels/"), "prueba");
  assert.equal(k("instagram", "https://www.instagram.com/p/ABC/"), null);
  assert.equal(k("instagram", "https://www.instagram.com/explore/tags/gatos/"), "explore/tags/gatos");
  assert.equal(k("tiktok", "https://www.tiktok.com/@tester/video/1"), "@tester");
  assert.equal(k("tiktok", "https://www.tiktok.com/search?q=Gatos"), "search:gatos");
  assert.equal(k("x", "https://x.com/pepe/status/1"), "pepe");
  assert.equal(k("x", "https://x.com/i/web/status/1"), null);
  assert.equal(k("x", "https://x.com/home"), "home");
  assert.equal(k("facebook", "https://www.facebook.com/profile.php?id=42"), "profile:42");
  assert.equal(k("facebook", "https://www.facebook.com/photo/?fbid=1"), null);
  assert.equal(k("facebook", "https://www.facebook.com/"), "home");
});

test("Store: dedupe/merge, contexts, sort with unknowns last, filters", () => {
  const s = new FO.Store();
  const base = { platform: "instagram", url: "https://www.instagram.com/p/x/", thumb: null, text: null, author: "a", shares: null, saves: null };
  s.add(
    [
      { ...base, id: "a", type: "reel", views: 100, likes: 10, comments: 0, date: Date.UTC(2024, 0, 1) },
      { ...base, id: "b", type: "photo", views: null, likes: 50, comments: 5, date: Date.UTC(2024, 5, 1), text: "Hola Mundo" },
      { ...base, id: "c", type: "reel", views: 1000, likes: 20, comments: 10, date: Date.UTC(2024, 2, 1) },
    ],
    [],
    "p1"
  );
  s.add([{ ...base, id: "a", type: "reel", views: 150, likes: null, comments: 1, date: Date.UTC(2024, 0, 1) }], [], "p2");
  assert.equal(s.count("p1"), 3);
  assert.equal(s.count("p2"), 1);
  const ids = (o) => plain(s.query(o).map((i) => i.id));
  assert.deepEqual(ids({ ctx: "p1", sortKey: "views" }), ["c", "a", "b"]);
  assert.deepEqual(ids({ ctx: "p1", sortKey: "views", dir: "asc" }), ["a", "c", "b"], "unknown views stay last");
  assert.deepEqual(ids({ ctx: "p1", sortKey: "feed", dir: "asc" }), ["a", "b", "c"]);
  assert.deepEqual(ids({ ctx: "p1", sortKey: "date" }), ["b", "c", "a"]);
  assert.deepEqual(ids({ ctx: "p1", type: "reel" }), ["c", "a"]);
  assert.deepEqual(ids({ ctx: "p1", minViews: 200 }), ["c"]);
  assert.deepEqual(ids({ ctx: "p1", query: "mundo" }), ["b"]);
  assert.deepEqual(ids({ ctx: "p1", from: Date.UTC(2024, 1, 1), to: Date.UTC(2024, 3, 1) }), ["c"]);
  const a = plain(s.query({ ctx: "p1" }).find((i) => i.id === "a"));
  assert.deepEqual([a.views, a.likes, a.comments], [150, 10, 1], "merge keeps known values and the larger counts");
  assert.equal(s.query({ ctx: "p1" }).find((i) => i.id === "c").engagement, 0.03);
  assert.deepEqual(ids({ ctx: "p1", sortKey: "engagement" }), ["a", "c", "b"]);
  s.clear("p2");
  assert.equal(s.count("p1"), 3, "clearing one context keeps posts seen elsewhere");
});

test("CSV: BOM, semicolons, quoting, formula injection and Spanish decimals", () => {
  const csv = FO.toCSV([
    {
      platform: "x", url: "https://x.com/a/status/1", author: "a", date: null, type: "text",
      views: 1000, likes: 10, comments: 2, shares: 0, saves: null, engagement: 0.012, outlier: 2.5,
      text: '=HYPERLINK("x"); "hola"\nchau',
    },
  ]);
  assert.ok(csv.startsWith("\uFEFFplataforma;url;autor;fecha;tipo;vistas;likes;comentarios;compartidos;guardados;engagement_%;outlier_x;texto\r\n"));
  const row = csv.split("\r\n")[1];
  assert.equal(row, 'x;https://x.com/a/status/1;a;;text;1000;10;2;0;;1,2;2,5;"\'=HYPERLINK(""x""); ""hola"" chau"');
});

test("Outlier score = views / median views of the page (likes when there are no views)", () => {
  const s = new FO.Store();
  const base = { platform: "instagram", url: "https://www.instagram.com/p/x/", thumb: null, text: null, author: "a", shares: null, saves: null, type: "reel", date: 1 };
  s.add(
    [
      { ...base, id: "a", views: 100, likes: 10, comments: 0 },
      { ...base, id: "b", views: 200, likes: 10, comments: 0 },
      { ...base, id: "c", views: 900, likes: 10, comments: 0 },
      { ...base, id: "d", views: null, likes: 30, comments: 0, type: "photo" },
    ],
    [],
    "p"
  );
  const r = plain(s.query({ ctx: "p", sortKey: "outlier" }).map((i) => [i.id, i.outlier]));
  assert.deepEqual(r, [["c", 4.5], ["d", 3], ["b", 1], ["a", 0.5]]);
});

test("limit keeps the N most recent posts of the feed; oldest sorts by date ascending", () => {
  const s = new FO.Store();
  const base = { platform: "tiktok", url: "https://www.tiktok.com/@a/video/1", thumb: null, text: null, author: "a", shares: null, saves: null, type: "video", likes: 1, comments: 1 };
  s.add([1, 2, 3, 4, 5].map((n) => ({ ...base, id: "v" + n, views: n * 10, date: 1000 - n })), [], "p");
  assert.deepEqual(plain(s.query({ ctx: "p", sortKey: "views", limit: 3 }).map((i) => i.id)), ["v3", "v2", "v1"]);
  assert.deepEqual(plain(s.query({ ctx: "p", sortKey: "oldest" }).map((i) => i.id)), ["v5", "v4", "v3", "v2", "v1"]);
});

test("JSON and TSV exports", () => {
  const it = { platform: "x", url: "https://x.com/a/status/1", author: "a", date: Date.UTC(2024, 0, 2, 3, 4), type: "photo", views: 10, likes: 2, comments: 1, shares: null, saves: null, engagement: 0.3, outlier: 1, text: "a\tb\nc" };
  const j = JSON.parse(FO.toJSON([it]));
  assert.equal(j.length, 1);
  assert.equal(j[0].vistas, 10);
  assert.equal(j[0]["engagement_%"], 30);
  assert.equal(j[0].fecha_iso, "2024-01-02T03:04:00.000Z");
  const tsv = FO.toTSV([it]).split("\n");
  assert.equal(tsv[0].split("\t").length, 13);
  assert.ok(tsv[1].endsWith("\ta b c"), "tabs/newlines inside text become spaces");
});

test("XLSX is a valid zip with a sheet holding every row", async () => {
  const { writeFileSync, mkdtempSync } = await import("node:fs");
  const { execFileSync } = await import("node:child_process");
  const os = await import("node:os");
  const items = Array.from({ length: 25 }, (_, n) => ({
    platform: "instagram", url: "https://www.instagram.com/p/C" + n + "/", author: "a & <b>", date: Date.UTC(2024, 0, 1 + n),
    type: "reel", views: 1000 + n, likes: 10, comments: 1, shares: null, saves: null, engagement: 0.011, outlier: 1.5, text: "texto \u0001 con \"comillas\" & <tags> ñandú 😀",
  }));
  const bytes = FO.toXLSX(items);
  const dir = mkdtempSync(path.join(os.tmpdir(), "fo-"));
  const file = path.join(dir, "t.xlsx");
  writeFileSync(file, Buffer.from(bytes));
  const check = `
import sys, zipfile, xml.dom.minidom
z = zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None
names = set(z.namelist())
for n in ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"]:
    assert n in names, n
    xml.dom.minidom.parseString(z.read(n))
sheet = xml.dom.minidom.parseString(z.read("xl/worksheets/sheet1.xml"))
rows = sheet.getElementsByTagName("row")
print(len(rows), rows[1].getElementsByTagName("t")[-1].firstChild.data)
`;
  const out = execFileSync("python3", ["-I", "-c", check, file], { encoding: "utf8" }).trim();
  assert.equal(out, '26 texto  con "comillas" & <tags> ñandú 😀');
});

test("extension files are valid UTF-8 without characters Chrome rejects", async () => {
  const { readdirSync, statSync } = await import("node:fs");
  const walk = (d) => readdirSync(d).flatMap((n) => (statSync(path.join(d, n)).isDirectory() ? walk(path.join(d, n)) : [path.join(d, n)]));
  const files = walk(path.join(here, "..", "extension")).filter((f) => /\.(js|html|css|json)$/.test(f));
  assert.ok(files.length > 10);
  for (const f of files) {
    const buf = readFileSync(f);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buf); // throws on invalid UTF-8
    assert.doesNotMatch(text, /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFEFF\uFFFE\uFFFF]/, path.relative(here, f));
  }
});

test("downloadable files: best quality video/photo per platform, all carousel items", () => {
  const ig = extractText("instagram", fixture("instagram_timeline.json")).items;
  assert.deepEqual(ig[0].media, [{ kind: "video", url: "https://scontent.cdninstagram.com/o1/v/high.mp4?x=1" }], "largest IG video");
  assert.deepEqual(ig[1].media, [{ kind: "image", url: "https://scontent.cdninstagram.com/foto1.jpg" }], "largest IG photo");
  assert.deepEqual(ig[2].media.map((m) => m.kind + ":" + m.url.split("/").pop()), ["image:c1.jpg", "video:c2.mp4"], "every carousel item");
  const tt = extractText("tiktok", fixture("tiktok_item_list.json")).items;
  assert.deepEqual(plain(tt[0].media), [{ kind: "video", url: "https://v16-webapp-prime.tiktok.com/video/tos/abc/?mime_type=video_mp4", alts: [], via: "fetch" }], "TikTok videos go through the extension's fetch");
  assert.equal(tt[1].media.length, 2, "TikTok photo post: every image");
  const x = extractText("x", fixture("x_user_tweets.json")).items;
  assert.deepEqual(x[0].media, [{ kind: "image", url: "https://pbs.twimg.com/media/a.jpg?name=orig" }], "X photo at original size");
  assert.equal(x[2].media[0].url, "https://video.twimg.com/ext_tw_video/1/pu/vid/1280x720/high.mp4?tag=12", "X: highest bitrate mp4");
  const fb = extractText("facebook", fixture("facebook_timeline.txt")).items;
  assert.deepEqual(fb[0].media, [{ kind: "image", url: "https://scontent.xx.fbcdn.net/p1.jpg" }], "FB photo, not the avatar");
  assert.deepEqual(fb[1].media, [{ kind: "video", url: "https://video.xx.fbcdn.net/v/hd777.mp4?b=2" }], "FB video in HD, not the shared post");
  assert.deepEqual(fb[2].media, [], "text-only post");
  const reel = extractText("facebook", fixture("facebook_reels.json")).items[0];
  assert.equal(reel.media[0].url, "https://video.xx.fbcdn.net/v/hd555.mp4?a=1");
});

test("download file names: folder per page, rank order, numbered carousel items, safe names", () => {
  const items = [
    { id: "REEL1", type: "reel", media: [{ kind: "video", url: "https://scontent.cdninstagram.com/o1/v/high.mp4?x=1" }] },
    { id: "NOPE", type: "photo", media: [] },
    { id: "a/b:c", type: "carousel", media: [{ kind: "image", url: "https://x.test/p.jpeg" }, { kind: "video", url: "https://v16.tiktok.com/video/tos/abc/?mime=mp4" }] },
  ];
  const r = FO.mediaFiles(items, { platform: "instagram", ctx: "explore/tags/gatos" });
  assert.equal(r.missing, 1);
  const tt = FO.mediaFiles([{ id: "7", type: "video", media: [{ kind: "video", url: "https://v16.tiktok.com/a", alts: ["https://v19.tiktok.com/a", "javascript:x"], via: "fetch" }] }], { platform: "tiktok", ctx: "@a" });
  assert.deepEqual(plain(tt.files), [{ url: "https://v16.tiktok.com/a", filename: "Valkiria/tiktok_@a/001_video_7.mp4", alts: ["https://v19.tiktok.com/a"], via: "fetch" }]);
  assert.equal(r.folder, "Valkiria/instagram_explore_tags_gatos");
  assert.deepEqual(plain(r.files.map((f) => f.filename)), [
    "Valkiria/instagram_explore_tags_gatos/001_reel_REEL1.mp4",
    "Valkiria/instagram_explore_tags_gatos/003_carousel_a_b_c_1.jpg",
    "Valkiria/instagram_explore_tags_gatos/003_carousel_a_b_c_2.mp4",
  ]);
});

test("Instagram reels tab: trimmed posts without date are detected; video left for the download", () => {
  const { items } = extractText("instagram", fixture("instagram_reels_tab.json"));
  assert.deepEqual(
    items.map((i) => [i.id, i.pk, i.type, i.views, i.likes, i.comments, i.date, i.media.length, i.url]),
    [
      ["DReelA1", "3111", "reel", 45000, 1200, 33, null, 0, "https://www.instagram.com/reel/DReelA1/"],
      ["DReelB2", "3112", "reel", 91000, 800, 12, null, 0, "https://www.instagram.com/reel/DReelB2/"],
    ]
  );
});

test("on a profile only the account's own posts count", () => {
  const own = { author: "Ana_E36" };
  const other = { author: "mdz_radio" };
  const unknown = { author: null };
  assert.equal(FO.belongsTo(own, "instagram", "ana_e36"), true);
  assert.equal(FO.belongsTo(other, "instagram", "ana_e36"), false);
  assert.equal(FO.belongsTo(unknown, "instagram", "ana_e36"), true, "posts without an author are kept");
  assert.equal(FO.belongsTo(other, "instagram", "explore/tags/gatos"), true, "not a profile: everything counts");
  assert.equal(FO.belongsTo(other, "instagram", "home"), true);
  assert.equal(FO.belongsTo(other, "instagram", "reels"), true);
  assert.equal(FO.belongsTo({ author: "creador" }, "tiktok", "@creador"), true);
  assert.equal(FO.belongsTo(other, "tiktok", "@creador"), false);
  assert.equal(FO.belongsTo(other, "x", "pepe"), false);
  assert.equal(FO.belongsTo(other, "x", "search:gatos"), true);
  assert.equal(FO.belongsTo(other, "facebook", "juan"), true, "Facebook shows display names, not usernames");
  assert.equal(FO.ctxKey("instagram", "https://www.instagram.com/ana_e36/tagged/"), "ana_e36/tagged", "tagged posts are other people's");
  assert.equal(FO.ctxKey("instagram", "https://www.instagram.com/ana_e36/reels/"), "ana_e36");
});

test("Instagram resolveMedia asks the post API for trimmed posts", async () => {
  const calls = [];
  const full = JSON.parse(fixture("instagram_timeline.json")).data.xdt_api__v1__feed__user_timeline_graphql_connection.edges[0].node;
  const ctx = vm.createContext({
    console, atob, URL, Date, Intl, Math, JSON, TextEncoder, DataView, ArrayBuffer, Uint8Array, Uint32Array,
    setTimeout: (fn) => fn(),
    location: { origin: "https://www.instagram.com" },
    fetch: async (url, opts) => {
      calls.push([url, opts.headers["x-ig-app-id"], opts.credentials]);
      return { ok: true, json: async () => ({ items: [full] }) };
    },
  });
  for (const f of FILES) vm.runInContext(readFileSync(path.join(ext, f), "utf8"), ctx, { filename: f });
  const item = { id: "REEL1", pk: "111", media: [], date: null, author: null };
  await ctx.FO.platforms.instagram.resolveMedia([item]);
  assert.deepEqual(calls, [["https://www.instagram.com/api/v1/media/111/info/", "936619743392459", "include"]]);
  assert.deepEqual(plain(item.media), [{ kind: "video", url: "https://scontent.cdninstagram.com/o1/v/high.mp4?x=1" }]);
  assert.equal(item.date, 1730000000000);
  assert.equal(item.author, "prueba");
});

test("self-update: reloads when the folder on disk has a new version, never during a download", async () => {
  const calls = { reload: 0, stored: null, badge: null };
  let diskVersion = "1.0.0";
  const listeners = {};
  const ev = (name) => ({ addListener: (fn) => (listeners[name] = fn) });
  const chromeMock = {
    runtime: {
      id: "testid",
      getManifest: () => ({ version: "1.0.0" }),
      getURL: (p) => "chrome-extension://testid/" + p,
      reload: () => calls.reload++,
      onMessage: ev("message"),
      sendMessage: async () => ({}),
      lastError: null,
    },
    declarativeNetRequest: { updateSessionRules: async () => {} },
    tabs: { TAB_ID_NONE: -1, sendMessage: async () => {} },
    downloads: { onChanged: ev("downloads"), download: (o, cb) => cb(1), search: (q, cb) => cb([]), erase: async () => {}, cancel: () => {} },
    offscreen: { hasDocument: async () => true, Reason: { BLOBS: "BLOBS" } },
    alarms: { create: () => {}, onAlarm: ev("alarm") },
    storage: { local: { get: (k, cb) => cb({}), set: async (o) => (calls.stored = o) } },
    action: { setBadgeText: (o) => (calls.badge = o.text), setBadgeBackgroundColor: () => {} },
  };
  const ctx = vm.createContext({
    console, URL, JSON, Promise, Map, Set, Date,
    setTimeout: (fn) => (fn(), 0),
    setInterval: () => 0,
    chrome: chromeMock,
    fetch: async () => ({ json: async () => ({ version: diskVersion }) }),
  });
  ctx.self = ctx;
  vm.runInContext(readFileSync(path.join(ext, "background.js"), "utf8"), ctx, { filename: "background.js" });
  await new Promise((r) => setImmediate(r)); // the check made at startup
  assert.equal(calls.reload, 0, "same version: no reload");

  diskVersion = "1.1.0";
  // A download in progress: wait for it to finish.
  listeners.message({ type: "fo:download", files: [{ url: "https://x.test/a.mp4", filename: "Valkiria/a.mp4" }] }, { tab: { id: 1 } }, () => {});
  assert.equal(await ctx.valkiriaCheckForUpdate(), false, "no reload during a download");
  assert.equal(calls.reload, 0);
  listeners.downloads({ id: 1, state: { current: "complete" } }); // the download ends

  assert.equal(await ctx.valkiriaCheckForUpdate(), true);
  assert.equal(calls.reload, 1, "new version on disk: reload");
  assert.deepEqual(plain(calls.stored.fo_updated).from, "1.0.0");
  assert.deepEqual(plain(calls.stored.fo_updated).to, "1.1.0");
});

test("Windows installer files: plain ASCII with CRLF, one PowerShell marker, same repository everywhere", () => {
  const root = path.join(here, "..");
  const files = ["instalar-valkiria.cmd", "tools/windows/actualizador/actualizar.ps1", "tools/windows/actualizador/actualizar.vbs", "tools/windows/carpeta/Actualizar ahora.cmd", "tools/windows/carpeta/Desactivar actualizaciones.cmd"];
  for (const f of files) {
    const buf = readFileSync(path.join(root, f));
    assert.ok(buf.every((b) => b < 128), f + " must be ASCII (cmd and Windows PowerShell 5.1)");
    const text = buf.toString("ascii");
    assert.equal((text.match(/\r\n/g) || []).length, (text.match(/\n/g) || []).length, f + " must use CRLF");
  }
  const installer = readFileSync(path.join(root, "instalar-valkiria.cmd"), "ascii");
  assert.equal(installer.split("\r\n").filter((l) => l.startsWith("###PS")).length, 1, "exactly one marker line");
  assert.ok(!installer.split("###PS")[0].includes("$ErrorActionPreference"), "PowerShell code lives after the marker");
  assert.match(installer, /IndexOf\('#'\+'##PS'\)/, "the cmd part finds the marker without containing it literally");
  const repos = new Set();
  for (const f of ["instalar-valkiria.cmd", "tools/windows/actualizador/actualizar.ps1", "extension/src/popup/popup.js"]) {
    const m = readFileSync(path.join(root, f), "utf8").match(/(?:\$Repo = '|const REPO = ")([\w.-]+\/[\w.-]+)/);
    assert.ok(m, f + " names the repository");
    repos.add(m[1]);
  }
  assert.deepEqual([...repos], ["Marquitomeschini/valkiria"]);
  const updater = readFileSync(path.join(root, "tools/windows/actualizador/actualizar.ps1"), "ascii");
  assert.match(updater, /\.Content \| ConvertFrom-Json\)\.version/, "raw.githubusercontent.com serves text/plain: parse it");
  assert.ok(!/\$args\s*=/.test(installer + updater), "$args is reserved in PowerShell");
});
