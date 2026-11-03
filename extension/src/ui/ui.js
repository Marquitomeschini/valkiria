(function (root) {
  "use strict";
  const FO = (root.FO = root.FO || {});
  const U = FO.util;

  const PAGE_SIZE = 120;
  const TYPE_NAMES = { reel: "Reel", video: "Video", photo: "Foto", carousel: "Carrusel", text: "Texto" };
  const SORT_LABELS = [
    ["views", "Vistas"],
    ["velocity", "Vistas por día"],
    ["likes", "Likes"],
    ["outlier", "Outlier score"],
    ["comments", "Comentarios"],
    ["shares", "Compartidos"],
    ["engagement", "Engagement"],
    ["newest", "Más recientes"],
    ["oldest", "Más antiguas"],
    ["feed", "Orden del feed"],
  ];
  // [masculine, feminine] phrase per sort, for "Reels más vistos" / "Publicaciones más vistas".
  const TITLES = {
    views: ["más vistos", "más vistas"],
    velocity: ["con más vistas por día", "con más vistas por día"],
    likes: ["con más likes", "con más likes"],
    comments: ["con más comentarios", "con más comentarios"],
    shares: ["más compartidos", "más compartidas"],
    engagement: ["con más engagement", "con más engagement"],
    outlier: ["con mayor outlier score", "con mayor outlier score"],
    newest: ["más recientes", "más recientes"],
    oldest: ["más antiguos", "más antiguas"],
    feed: ["en el orden del feed", "en el orden del feed"],
  };
  const ICONS = {
    velocity: "M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z",
    gridView: "M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z",
    tableView: "M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h18v2H3v-2z",
    chartView: "M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z",
    bookmark: "M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z",
    refresh: "M17.65 6.35A7.958 7.958 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
    library: "M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z",
    views: "M8 5v14l11-7z",
    likes: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
    comments: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z",
    shares: "M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z",
    outlier: "M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z",
    engagement: "M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z",
    date: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z",
    download: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
    copy: "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z",
    open: "M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z",
    exportIcon: "M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6a2 2 0 0 1-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3a2 2 0 0 1 2 2z",
    filter: "M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z",
    sort: "M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z",
    rune: "M12 1.6l7.7 7.7-1.6 1.6L13.1 6.1V22.4h-2.2V6.1L6 10.9 4.3 9.3z",
    check: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
    back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
    reel: "M4 4h16v16H4V4zm2 2v12h12V6H6zm4 2.5l5 3.5-5 3.5v-7z",
    carousel: "M8 2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v12h12V4H8zM2 8h2v12h12v2H4a2 2 0 0 1-2-2V8z",
  };

  const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.fo { font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: var(--fg); }
.fo.dark  { --page: #0b0b0d; --card: #1c1d21; --card2: #25262b; --fg: #f2f2f4; --muted: #9b9ca5; --line: #2f3036; --hover: #2b2c31; }
.fo.light { --page: #f4f4f6; --card: #ffffff; --card2: #f3f3f6; --fg: #16161a; --muted: #6c6d76; --line: #e2e2e8; --hover: #ededf2; }
.fo { --accent: #e6b955; --accent2: #e6b955; }
.fo.light { --viz-1: #2a78d6; --viz-2: #eb6834; --viz-3: #1baf7a; --viz-grid: #e6e6ea; --viz-surface: #ffffff; --viz-text: #16161a; --viz-muted: #6c6d76; --viz-tip-bg: #16161a; --viz-tip-fg: #ffffff; }
.fo.dark  { --viz-1: #3987e5; --viz-2: #d95926; --viz-3: #199e70; --viz-grid: #2f3036; --viz-surface: #1c1d21; --viz-text: #f2f2f4; --viz-muted: #9b9ca5; --viz-tip-bg: #f2f2f4; --viz-tip-fg: #16161a; }
.statusline { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; color: var(--muted); font-size: 12.5px; margin-top: 6px; }
.statusline .warn { color: var(--accent); }
.statusline button { font: 600 12.5px system-ui, sans-serif; color: var(--accent); background: none; border: 0; padding: 0; cursor: pointer; display: inline-flex; gap: 4px; align-items: center; }
.statusline button svg { width: 14px; height: 14px; }
.views { display: inline-flex; background: var(--card2); border: 1px solid var(--line); border-radius: 9px; padding: 2px; gap: 2px; }
.views button { display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: var(--muted); font: 500 13px system-ui, sans-serif; padding: 0 10px; height: 28px; border-radius: 7px; cursor: pointer; }
.views button svg { width: 15px; height: 15px; }
.views button[aria-pressed="true"] { background: var(--card); color: var(--fg); box-shadow: 0 1px 2px rgba(0,0,0,.15); }
.tablewrap { overflow-x: auto; border-top: 1px solid var(--line); }
table.t { width: 100%; border-collapse: collapse; font: 13px system-ui, sans-serif; font-variant-numeric: tabular-nums; }
table.t th { text-align: right; font-weight: 600; color: var(--muted); padding: 9px 10px; border-bottom: 1px solid var(--line); white-space: nowrap; cursor: pointer; user-select: none; position: sticky; top: 0; background: var(--card); }
table.t th.l, table.t td.l { text-align: left; }
table.t th.on { color: var(--fg); }
table.t td { padding: 6px 10px; border-bottom: 1px solid var(--line); text-align: right; white-space: nowrap; color: var(--fg); }
table.t tr { cursor: pointer; }
table.t tbody tr:hover td { background: var(--hover); }
table.t tr.sel td { background: var(--hover); box-shadow: inset 3px 0 0 var(--accent); }
table.t td.txt { max-width: 340px; overflow: hidden; text-overflow: ellipsis; color: var(--muted); }
table.t img { width: 40px; height: 40px; object-fit: cover; border-radius: 6px; display: block; }
table.t td.th { width: 52px; }
.summary { border-top: 1px solid var(--line); padding: 16px; display: grid; gap: 14px; }
.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.stat { background: var(--card2); border-radius: 10px; padding: 12px 14px; }
.stat .k { color: var(--muted); font-size: 12.5px; }
.stat .v { font-size: 22px; font-weight: 650; margin-top: 2px; color: var(--fg); }
.stat .h { color: var(--muted); font-size: 11.5px; margin-top: 2px; }
.charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 14px; }
.chart { background: var(--card2); border-radius: 10px; padding: 12px 14px 10px; }
.chart h3 { margin: 0 0 2px; font-size: 14px; color: var(--fg); }
.chart .h { color: var(--muted); font-size: 12px; margin-bottom: 8px; }
.chart.wide { grid-column: 1 / -1; }
.savebox { position: absolute; right: 0; top: calc(100% + 6px); z-index: 6; width: 260px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 14px 40px rgba(0,0,0,.35); padding: 10px; display: none; }
.savebox.on { display: block; }
.savebox .lst { display: grid; gap: 2px; max-height: 180px; overflow: auto; margin-bottom: 8px; }
.savebox .lst button { text-align: left; border: 0; background: transparent; color: var(--fg); font: 13px system-ui, sans-serif; padding: 7px 8px; border-radius: 7px; cursor: pointer; }
.savebox .lst button:hover { background: var(--hover); }
.savebox .new { display: flex; gap: 6px; }
.savebox .new input { flex: 1; min-width: 0; }
.savebox .t { color: var(--muted); font-size: 12px; margin: 0 2px 6px; }
svg { width: 18px; height: 18px; fill: currentColor; flex: none; }

/* ---------- loading ---------- */
.veil { position: fixed; inset: 0; z-index: 2147483645; background: rgba(0,0,0,.22); backdrop-filter: blur(14px) saturate(.9); -webkit-backdrop-filter: blur(14px); display: none; }
.veil.on { display: block; }
.toast {
  position: fixed; left: 50%; top: 56px; transform: translateX(-50%); z-index: 2147483646; width: min(560px, calc(100vw - 32px));
  background: #17181c; color: #f2f2f4; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.45); overflow: hidden; display: none;
}
.toast.on { display: block; }
.toast .row { display: flex; align-items: center; gap: 12px; padding: 13px 16px; }
.toast .msg { flex: 1; font-weight: 500; font-variant-numeric: tabular-nums; }
.toast button { font: 600 12.5px system-ui, sans-serif; color: #cfd0d6; background: transparent; border: 1px solid #3a3b42; border-radius: 8px; padding: 5px 10px; cursor: pointer; }
.toast button:hover { color: #fff; border-color: #5a5b63; }
.bar { height: 3px; background: rgba(255,255,255,.08); position: relative; overflow: hidden; }
.bar > i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: var(--accent); transition: width .3s; }
.bar.indet > i { width: 30%; animation: indet 1.3s ease-in-out infinite; }
@keyframes indet { from { left: -30%; } to { left: 100%; } }

/* ---------- results ---------- */
.results { position: fixed; inset: 0; z-index: 2147483644; background: var(--page); overflow: auto; overscroll-behavior: contain; display: none; }
.results.on { display: block; }
.wrap { max-width: 1000px; margin: 0 auto; padding: 18px 16px 60px; }
.topbar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; color: var(--muted); }
.brand { display: flex; align-items: center; gap: 7px; font-weight: 700; color: var(--fg); margin-left: auto; font-size: 13px; }
.brand svg { fill: var(--accent2); width: 16px; height: 16px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; overflow: visible; }
.head { display: flex; align-items: center; gap: 12px; padding: 18px 20px 16px; flex-wrap: wrap; }
.head h1 { margin: 0; font-size: 21px; line-height: 1.2; font-weight: 700; color: var(--fg); }
.head .sub { color: var(--muted); font-size: 13px; margin-top: 2px; }
.head .sub b { color: var(--fg); font-weight: 600; }
.head .grow { flex: 1; min-width: 180px; }
.tools { display: flex; align-items: center; gap: 6px; padding: 10px 14px; border-top: 1px solid var(--line); flex-wrap: wrap; }
.tools .grow { flex: 1; }
button.b {
  display: inline-flex; align-items: center; gap: 7px; font: 500 13.5px/1 system-ui, sans-serif; color: var(--fg); background: transparent;
  border: 1px solid transparent; border-radius: 9px; padding: 0 11px; height: 34px; cursor: pointer; white-space: nowrap;
}
button.b svg { width: 16px; height: 16px; color: var(--muted); }
button.b:hover { background: var(--hover); }
button.b.outline { border-color: var(--line); }
button.b .n { color: var(--muted); font-weight: 500; }
button.b.muted { color: var(--muted); }
button.b.on { background: var(--hover); }
button.b:disabled { opacity: .45; cursor: default; background: transparent; }
.menuwrap { position: relative; }
.sortwrap { display: inline-flex; align-items: center; gap: 6px; margin: 0 2px 0 8px; }
.sortwrap svg { width: 16px; height: 16px; color: var(--muted); }
.menu {
  position: absolute; right: 0; top: calc(100% + 6px); z-index: 5; min-width: 230px; background: var(--card); border: 1px solid var(--line);
  border-radius: 12px; box-shadow: 0 14px 40px rgba(0,0,0,.35); padding: 6px; display: none;
}
.menu.on { display: block; }
.mi { display: flex; align-items: center; gap: 6px; padding: 4px 4px 4px 10px; border-radius: 8px; }
.mi:hover { background: var(--hover); }
.mi span { flex: 1; font-size: 13.5px; }
.mi button { width: 30px; height: 30px; border: 0; background: transparent; color: var(--muted); border-radius: 7px; cursor: pointer; display: grid; place-items: center; }
.mi button:hover { color: var(--fg); background: var(--card2); }
.mi button svg { width: 16px; height: 16px; }
select.s, input.s {
  font: 13px system-ui, sans-serif; color: var(--fg); background: var(--card2); border: 1px solid var(--line); border-radius: 8px; height: 32px; padding: 0 8px;
}
input.s[type=number] { width: 100px; }
input.s[type=search] { width: 170px; }
.filters { display: none; gap: 10px 14px; padding: 10px 18px 14px; border-top: 1px solid var(--line); flex-wrap: wrap; align-items: center; color: var(--muted); font-size: 13px; }
.filters.on { display: flex; }
.filters label { display: flex; align-items: center; gap: 6px; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; border-top: 1px solid var(--line); }
@media (max-width: 760px) { .grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 480px) { .grid { grid-template-columns: repeat(2, 1fr); } }
.tile { position: relative; display: block; aspect-ratio: 3 / 4; background: var(--card2); overflow: hidden; color: #fff; text-decoration: none; cursor: pointer; }
.grid.tall .tile { aspect-ratio: 9 / 16; }
.tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
.tile .txt { position: absolute; inset: 0; padding: 40px 14px 40px; color: var(--fg); font-size: 13px; line-height: 1.45; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 10; -webkit-box-orient: vertical; }
.tile .shade { position: absolute; left: 0; right: 0; bottom: 0; height: 60px; background: linear-gradient(transparent, rgba(0,0,0,.55)); pointer-events: none; }
.tile .main { position: absolute; left: 10px; bottom: 9px; display: flex; align-items: center; gap: 4px; font-weight: 600; font-size: 14px; text-shadow: 0 1px 3px rgba(0,0,0,.6); }
.tile .main svg { width: 16px; height: 16px; filter: drop-shadow(0 1px 2px rgba(0,0,0,.6)); }
.tile .rank { position: absolute; left: 8px; top: 8px; font-size: 11.5px; font-weight: 700; padding: 2px 7px; border-radius: 999px; background: rgba(0,0,0,.55); }
.tile .kind { position: absolute; right: 8px; top: 8px; filter: drop-shadow(0 1px 2px rgba(0,0,0,.7)); }
.tile .kind svg { width: 18px; height: 18px; }
.tile .hover { position: absolute; inset: 0; background: rgba(0,0,0,.62); display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 7px; opacity: 0; transition: opacity .12s; font-weight: 600; font-size: 14px; }
.tile:hover .hover { opacity: 1; }
.tile .hover div { display: flex; align-items: center; gap: 6px; }
.tile .hover svg { width: 16px; height: 16px; }
.tile .hover .d { font-weight: 500; font-size: 12.5px; opacity: .85; }
.tile .pick { position: absolute; left: 8px; top: 8px; width: 24px; height: 24px; border-radius: 50%; border: 2px solid #fff; background: rgba(0,0,0,.25); display: none; place-items: center; }
.selecting .tile .pick { display: grid; }
.selecting .tile .rank { display: none; }
.selecting .tile .hover { display: none; }
.tile.sel .pick { background: #fff; color: #111; }
.tile.sel .pick svg { width: 16px; height: 16px; }
.tile.sel::after { content: ""; position: absolute; inset: 0; box-shadow: inset 0 0 0 3px #fff; pointer-events: none; }
.tile .pick svg { display: none; }
.tile.sel .pick svg { display: block; }
.empty { grid-column: 1 / -1; text-align: center; color: var(--muted); padding: 60px 20px; }
.more { display: flex; justify-content: center; padding: 18px; border-top: 1px solid var(--line); }
.note { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); z-index: 2147483647; background: #17181c; color: #fff; padding: 10px 16px; border-radius: 10px; font-size: 13.5px; box-shadow: 0 10px 30px rgba(0,0,0,.4); display: none; max-width: calc(100vw - 32px); }
.note.on { display: block; }
.dl { position: fixed; left: 20px; bottom: 20px; z-index: 2147483647; width: min(380px, calc(100vw - 40px)); background: #17181c; color: #f2f2f4; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.45); overflow: hidden; display: none; font-size: 13.5px; }
.dl.on { display: block; }
.dl .row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; }
.dl .msg { flex: 1; line-height: 1.4; font-variant-numeric: tabular-nums; }
.dl .msg small { display: block; color: #a6a7b0; font-size: 12px; margin-top: 2px; word-break: break-all; }
.dl button { font: 600 12.5px system-ui, sans-serif; color: #cfd0d6; background: transparent; border: 1px solid #3a3b42; border-radius: 8px; padding: 5px 10px; cursor: pointer; }
.dl button:hover { color: #fff; border-color: #5a5b63; }
`;

  function h(tag, props) {
    const el = document.createElement(tag);
    if (props) {
      for (const k of Object.keys(props)) {
        const v = props[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? "" : String(v));
      }
    }
    for (let i = 2; i < arguments.length; i++) {
      for (const c of [].concat(arguments[i])) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : String(c));
    }
    return el;
  }
  function icon(name) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", ICONS[name]);
    svg.appendChild(p);
    return svg;
  }

  const full = new Intl.NumberFormat("es-AR");
  const oneDec = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
  function compact(n) {
    const a = Math.abs(n);
    if (a < 1000) return full.format(n);
    if (a < 1e6) return oneDec.format(n / 1e3) + " k";
    if (a < 1e9) return oneDec.format(n / 1e6) + " M";
    return oneDec.format(n / 1e9) + " B";
  }
  const dateFmt = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" });
  const fmt = {
    views: (v) => compact(v),
    likes: (v) => compact(v),
    comments: (v) => compact(v),
    shares: (v) => compact(v),
    engagement: (v) => oneDec.format(v * 100) + " %",
    outlier: (v) => oneDec.format(v) + "x",
    velocity: (v) => compact(v) + "/día",
    date: (v) => dateFmt.format(new Date(v)),
    duration: (v) => (v < 60 ? Math.round(v) + " s" : Math.floor(v / 60) + ":" + String(Math.round(v % 60)).padStart(2, "0")),
  };
  const DAY = 86400000;
  function ago(ms) {
    const m = Math.round((Date.now() - ms) / 60000);
    if (m < 1) return "recién";
    if (m < 60) return "hace " + m + " min";
    const hh = Math.round(m / 60);
    if (hh < 48) return "hace " + hh + " h";
    return "hace " + Math.round(hh / 24) + " días";
  }

  function pageIsDark() {
    const parse = (c) => {
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c || "");
      return m && (m[4] === undefined || Number(m[4]) > 0.5) ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
    };
    const rgb = (document.body && parse(getComputedStyle(document.body).backgroundColor)) || parse(getComputedStyle(document.documentElement).backgroundColor);
    if (rgb) return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 < 0.45;
    return !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
  }

  /**
   * opts: { platform, store, getCtx, onStop, nounFor }
   */
  FO.createUI = function (opts) {
    const platform = opts.platform;
    const store = opts.store;
    const adapter = FO.platforms[platform];

    const host = document.createElement("div");
    host.id = "valkiria-root";
    const shadow = host.attachShadow({ mode: "open" });
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS + (FO.charts ? FO.charts.CSS : ""));
      shadow.adoptedStyleSheets = [sheet];
    } catch (_) {
      shadow.appendChild(h("style", { text: CSS + (FO.charts ? FO.charts.CSS : "") }));
    }
    const root = h("div", { class: "fo dark" });
    shadow.appendChild(root);
    // Keep keystrokes and scrolling inside our layers away from the site (e.g. "l" = like on X).
    for (const type of ["keydown", "keyup", "keypress"]) {
      root.addEventListener(type, (e) => {
        if (type === "keydown" && e.key === "Escape") {
          if (menu.classList.contains("on")) menu.classList.remove("on");
          else hideResults();
        }
        e.stopPropagation();
      });
    }

    // ================= loading =================
    const veil = h("div", { class: "veil" });
    for (const t of ["wheel", "touchmove"]) veil.addEventListener(t, (e) => e.preventDefault(), { passive: false });
    const toastMsg = h("span", { class: "msg" });
    const barFill = h("i");
    const bar = h("div", { class: "bar" }, barFill);
    const stopBtn = h("button", { text: "Detener", onclick: () => opts.onStop && opts.onStop() });
    const toast = h("div", { class: "toast", role: "status" }, h("div", { class: "row" }, toastMsg, stopBtn), bar);

    function showLoading() {
      root.className = "fo " + (pageIsDark() ? "dark" : "light");
      hideResults();
      veil.classList.add("on");
      toast.classList.add("on");
      updateLoading(0, null, "");
    }
    function updateLoading(n, frac, noun) {
      toastMsg.textContent = n + " " + (noun || "publicaciones") + " cargad" + (noun === "publicaciones" ? "as" : "os") + " — no hagas scroll";
      if (frac == null) {
        bar.classList.add("indet");
        barFill.style.width = "";
      } else {
        bar.classList.remove("indet");
        barFill.style.width = Math.max(3, Math.min(100, frac * 100)) + "%";
      }
    }
    function hideLoading() {
      veil.classList.remove("on");
      toast.classList.remove("on");
    }

    // ================= results =================
    const S = {
      open: false,
      sortKey: "views",
      dir: null,
      limit: null,
      from: null,
      to: null,
      type: "all",
      minViews: "",
      query: "",
      ctx: null,
      noun: "publicaciones",
      shown: PAGE_SIZE,
      selecting: false,
      selected: new Set(),
      view: "grid",
      dur: "all",
      loadInfo: null,
    };
    const DURATIONS = { all: [null, null], short: [null, 15], mid: [15, 60], long: [60, 180], xlong: [180, null] };

    const titleEl = h("h1");
    const statusLine = h("div", { class: "statusline" });
    const subEl = h("div", { class: "sub" });
    const exportBtn = h("button", { class: "b outline", onclick: (e) => { e.stopPropagation(); menu.classList.toggle("on"); } });
    const cancelSelBtn = h("button", { class: "b muted", text: "Cancelar", onclick: () => setSelecting(false) });
    const downloadBtn = h("button", { class: "b", onclick: () => downloadMedia() });

    function menuItem(label, actions) {
      return h(
        "div",
        { class: "mi" },
        h("span", { text: label }),
        actions.map(([ic, title, fn]) => h("button", { title, "aria-label": title, onclick: (e) => { e.stopPropagation(); menu.classList.remove("on"); fn(); } }, icon(ic)))
      );
    }
    const menu = h(
      "div",
      { class: "menu", role: "menu" },
      menuItem("Google Sheets", [
        ["open", "Copiar y abrir una hoja nueva", () => exportTo("sheets-open")],
        ["copy", "Copiar para pegar en Sheets", () => exportTo("tsv-copy")],
      ]),
      menuItem("Excel", [
        ["download", "Descargar .xlsx", () => exportTo("xlsx")],
        ["copy", "Copiar para pegar en Excel", () => exportTo("tsv-copy")],
      ]),
      menuItem("CSV", [
        ["download", "Descargar .csv", () => exportTo("csv")],
        ["copy", "Copiar CSV", () => exportTo("csv-copy")],
      ]),
      menuItem("JSON", [
        ["download", "Descargar .json", () => exportTo("json")],
        ["copy", "Copiar JSON", () => exportTo("json-copy")],
      ])
    );
    document.addEventListener("click", () => menu.classList.remove("on"), true);

    const filtersBtn = h("button", { class: "b", onclick: () => { filtersRow.classList.toggle("on"); filtersBtn.classList.toggle("on"); } }, icon("filter"), "Filtros");
    const sortSel = h("select", { class: "s", "aria-label": "Ordenar por", onchange: () => update({ sortKey: sortSel.value, dir: null }) }, SORT_LABELS.map(([v, t]) => h("option", { value: v, text: t })));
    const dirBtn = h("button", { class: "b", title: "Invertir orden", onclick: () => update({ dir: currentDir() === "desc" ? "asc" : "desc" }) });
    const clearBtn = h("button", { class: "b muted", text: "Limpiar filtros", onclick: () => clearFilters() });
    const selectBtn = h("button", { class: "b", onclick: () => setSelecting(!S.selecting) }, icon("check"), "Seleccionar");
    const viewBtns = {};
    const viewTabs = h(
      "div",
      { class: "views", role: "group", "aria-label": "Vista" },
      [["grid", "gridView", "Grilla"], ["table", "tableView", "Tabla"], ["summary", "chartView", "Resumen"]].map(([v, ic, label]) => (viewBtns[v] = h("button", { "aria-pressed": "false", onclick: () => update({ view: v }) }, icon(ic), label)))
    );
    const durSel = h(
      "select",
      { class: "s", "aria-label": "Duración", onchange: () => update({ dur: durSel.value }) },
      [["all", "Cualquiera"], ["short", "Menos de 15 s"], ["mid", "15 a 60 s"], ["long", "1 a 3 min"], ["xlong", "Más de 3 min"]].map(([v, t]) => h("option", { value: v, text: t }))
    );
    // "Guardar" (select mode): add the selected posts to a collection.
    const saveName = h("input", { class: "s", type: "text", placeholder: "Nueva colección", maxlength: "60", "aria-label": "Nombre de la colección" });
    const saveList = h("div", { class: "lst" });
    const saveBox = h(
      "div",
      { class: "savebox", onclick: (e) => e.stopPropagation() },
      h("div", { class: "t", text: "Guardar en una colección" }),
      saveList,
      h("div", { class: "new" }, saveName, h("button", { class: "b outline", text: "Crear", onclick: () => saveTo(saveName.value) }))
    );
    saveName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveTo(saveName.value);
    });
    const saveBtn = h("button", { class: "b", onclick: (e) => { e.stopPropagation(); openSaveBox(); } }, icon("bookmark"), "Guardar");

    const typeSel = h("select", { class: "s", "aria-label": "Tipo", onchange: () => update({ type: typeSel.value }) });
    const fromIn = h("input", { class: "s", type: "date", "aria-label": "Desde", onchange: () => update({ from: dayStart(fromIn.value) }) });
    const toIn = h("input", { class: "s", type: "date", "aria-label": "Hasta", onchange: () => update({ to: dayEnd(toIn.value) }) });
    const minIn = h("input", { class: "s", type: "number", min: "0", step: "1000", placeholder: "0", "aria-label": "Vistas mínimas", oninput: () => update({ minViews: minIn.value }) });
    const qIn = h("input", { class: "s", type: "search", placeholder: "Texto o @autor", "aria-label": "Buscar", oninput: () => update({ query: qIn.value }) });
    const filtersRow = h(
      "div",
      { class: "filters" },
      h("label", null, "Tipo", typeSel),
      h("label", null, "Desde", fromIn),
      h("label", null, "Hasta", toIn),
      h("label", null, "Vistas mín.", minIn),
      h("label", null, "Duración", durSel),
      qIn
    );

    const grid = h("div", { class: "grid" });
    const tableBox = h("div", { class: "tablewrap" });
    const summaryBox = h("div", { class: "summary" });
    const more = h("div", { class: "more" });
    const card = h(
      "div",
      { class: "card" },
      h("div", { class: "head" }, h("div", { class: "grow" }, titleEl, subEl, statusLine), cancelSelBtn, h("div", { class: "menuwrap" }, saveBtn, saveBox), downloadBtn, h("div", { class: "menuwrap" }, exportBtn, menu)),
      h("div", { class: "tools" }, filtersBtn, h("label", { class: "sortwrap" }, icon("sort"), sortSel), dirBtn, clearBtn, h("span", { class: "grow" }), viewTabs, selectBtn),
      filtersRow,
      grid,
      tableBox,
      summaryBox,
      more
    );
    const results = h(
      "div",
      { class: "results", role: "dialog", tabindex: "-1", "aria-label": "Resultados de Valkiria" },
      h(
        "div",
        { class: "wrap" },
        h(
          "div",
          { class: "topbar" },
          h("button", { class: "b", onclick: () => hideResults() }, icon("back"), "Volver a la página"),
          h("span", { class: "brand" }, h("button", { class: "b", title: "Colecciones, perfiles guardados y comparar", onclick: () => openApp() }, icon("library"), "Colecciones y comparar"), icon("rune"), "Valkiria")
        ),
        card
      )
    );
    const note = h("div", { class: "note", role: "status" });
    const dlMsg = h("span", { class: "msg" });
    const dlFill = h("i");
    const dlBtn = h("button", { text: "Cancelar" });
    const dlBox = h("div", { class: "dl", role: "status" }, h("div", { class: "row" }, dlMsg, dlBtn), h("div", { class: "bar" }, dlFill));
    root.append(results, veil, toast, note, dlBox);

    function dayStart(v) {
      return v ? new Date(v + "T00:00:00").getTime() : null;
    }
    function dayEnd(v) {
      return v ? new Date(v + "T23:59:59.999").getTime() : null;
    }
    function toInput(ms) {
      if (ms == null) return "";
      const d = new Date(ms);
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    function currentDir() {
      return S.dir || (FO.SORTS[S.sortKey] || FO.SORTS.views)[1];
    }

    function queryOpts(extra) {
      return Object.assign(
        {
          ctx: S.ctx,
          sortKey: S.sortKey,
          dir: currentDir(),
          limit: S.limit,
          type: S.type,
          from: S.from,
          to: S.to,
          minViews: S.minViews === "" ? null : Number(S.minViews),
          minDur: DURATIONS[S.dur][0],
          maxDur: DURATIONS[S.dur][1],
          query: S.query,
        },
        extra
      );
    }

    function update(patch) {
      Object.assign(S, patch, { shown: PAGE_SIZE });
      render();
    }
    function clearFilters() {
      update({ type: "all", from: S.baseFrom, to: S.baseTo, minViews: "", query: "", dur: "all" });
    }
    function setSelecting(on) {
      S.selecting = on;
      if (!on) S.selected.clear();
      saveBox.classList.remove("on");
      render();
    }

    // ---- collections ----
    async function openSaveBox() {
      menu.classList.remove("on");
      if (saveBox.classList.toggle("on")) {
        const names = await FO.collections.names().catch(() => []);
        saveList.replaceChildren(...names.map((n) => h("button", { text: n, onclick: () => saveTo(n) })));
        if (!names.length) saveList.replaceChildren(h("div", { class: "t", text: "Todavía no tenés colecciones: escribí un nombre." }));
        saveName.focus();
      }
    }
    async function saveTo(name) {
      name = String(name || "").trim();
      if (!name) return saveName.focus();
      const snap = new Map(store.snapshot(S.ctx).map((x) => [x.id, x]));
      const items = lastList.filter((it) => S.selected.has(it.id)).map((it) => snap.get(it.id) || it);
      const added = await FO.collections.add(name, items).catch(() => -1);
      saveBox.classList.remove("on");
      saveName.value = "";
      flash(added < 0 ? "No se pudo guardar." : added + (added === 1 ? " publicación guardada" : " publicaciones guardadas") + " en «" + name + "».");
    }
    function openApp(tab) {
      try {
        chrome.runtime.sendMessage({ type: "fo:open-app", tab: tab || "" }).catch(() => {});
      } catch (_) {
        flash("Recargá la página: la extensión se actualizó.");
      }
    }
    // Bubble phase: clicks inside the box (stopped there) keep it open, so you can type a name.
    document.addEventListener("click", () => saveBox.classList.remove("on"));

    // ---- media downloads (done by the service worker) ----
    const TOP_DOWNLOADS = 100;
    const dl = { job: null, folder: "", missing: 0, hideTimer: 0 };
    function dlShow(text, sub, frac, button) {
      dlMsg.replaceChildren(text, sub ? h("small", { text: sub }) : null);
      dlFill.style.width = frac == null ? "0" : Math.max(2, Math.min(100, frac * 100)) + "%";
      dlBtn.textContent = button === "close" ? "Cerrar" : "Cancelar";
      dlBox.classList.add("on");
      clearTimeout(dl.hideTimer);
    }
    dlBtn.addEventListener("click", () => {
      if (dl.job) {
        try {
          chrome.runtime.sendMessage({ type: "fo:download-cancel", jobId: dl.job });
        } catch (_) {}
      } else dlBox.classList.remove("on");
    });
    async function downloadMedia() {
      if (dl.job || dl.preparing) return;
      const list = S.selecting ? lastList.filter((it) => S.selected.has(it.id)) : lastList.slice(0, TOP_DOWNLOADS);
      // Some grids send trimmed posts without the video: ask the site for those first.
      const trimmed = adapter.resolveMedia ? list.filter((it) => !(it.media && it.media.length) && it.pk) : [];
      if (trimmed.length) {
        dl.preparing = true;
        renderHeader();
        dlShow("Buscando los archivos de " + trimmed.length + " publicaciones…", null, 0, "close");
        try {
          await adapter.resolveMedia(trimmed, (n, total) => dlShow("Buscando los archivos… " + n + " de " + total, null, n / total, "close"));
        } finally {
          dl.preparing = false;
        }
      }
      const { files, missing, folder } = FO.mediaFiles(list, { platform, ctx: S.ctx });
      if (!files.length) return flash("Estas publicaciones no traen videos ni fotos descargables.");
      dl.folder = folder;
      dl.missing = missing;
      dlShow("Preparando " + files.length + " archivos…", null, 0);
      try {
        chrome.runtime.sendMessage({ type: "fo:download", files }, (res) => {
          void chrome.runtime.lastError;
          if (!res || !res.ok) {
            dl.job = null;
            dlShow("No se pudo empezar la descarga.", "Recargá la extensión en chrome://extensions y probá de nuevo.", null, "close");
            return;
          }
          dl.job = res.jobId;
          renderHeader();
        });
      } catch (_) {
        dlShow("No se pudo empezar la descarga.", "Recargá la página y probá de nuevo.", null, "close");
      }
    }
    function onDownloadProgress(p) {
      if (p.jobId !== dl.job) return;
      const where = "Descargas/" + dl.folder;
      if (!p.finished) {
        dlShow("Descargando " + (p.done + p.failed) + " de " + p.total + " archivos…", where, (p.done + p.failed) / p.total);
        return;
      }
      dl.job = null;
      renderHeader();
      const extra = [p.failed ? p.failed + " no se pudieron bajar" : "", dl.missing ? dl.missing + " sin archivo" : ""].filter(Boolean).join(" · ");
      dlShow((p.cancelled ? "Cancelado: " : "Listo: ") + p.done + " de " + p.total + " archivos" + (extra ? " · " + extra : ""), where, 1, "close");
      dl.hideTimer = setTimeout(() => dlBox.classList.remove("on"), 15000);
    }
    try {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === "fo:download-progress") onDownloadProgress(msg);
      });
    } catch (_) {}

    function flash(text) {
      note.textContent = text;
      note.classList.add("on");
      clearTimeout(flash.t);
      flash.t = setTimeout(() => note.classList.remove("on"), 3200);
    }

    function selectedOrAll() {
      const list = store.query(queryOpts());
      return S.selecting ? list.filter((it) => S.selected.has(it.id)) : list;
    }

    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {
        const ta = h("textarea");
        ta.value = text;
        root.appendChild(ta);
        ta.select();
        let ok = false;
        try {
          ok = document.execCommand("copy");
        } catch (_) {}
        ta.remove();
        return ok;
      }
    }

    function download(data, mime, ext) {
      const blob = new Blob([data], { type: mime });
      const url = URL.createObjectURL(blob);
      const ctx = (S.ctx || "todo").replace(/[^\w@.-]+/g, "_").slice(0, 60);
      const d = new Date();
      const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
      const a = h("a", { href: url, download: `valkiria_${platform}_${ctx}_${S.sortKey}_${stamp}.${ext}` });
      root.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    }

    async function exportTo(kind) {
      const list = selectedOrAll();
      if (!list.length) return flash("No hay publicaciones para exportar.");
      const n = list.length + (list.length === 1 ? " fila" : " filas");
      if (kind === "csv") download(FO.toCSV(list), "text/csv;charset=utf-8", "csv");
      else if (kind === "json") download(FO.toJSON(list), "application/json", "json");
      else if (kind === "xlsx") download(FO.toXLSX(list), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx");
      else if (kind === "csv-copy") flash((await copyText(FO.toCSV(list).replace(/^\uFEFF/, ""))) ? "CSV copiado (" + n + ")." : "No se pudo copiar.");
      else if (kind === "json-copy") flash((await copyText(FO.toJSON(list))) ? "JSON copiado (" + n + ")." : "No se pudo copiar.");
      else if (kind === "tsv-copy") flash((await copyText(FO.toTSV(list))) ? "Copiado (" + n + "). Pegalo en la hoja con Ctrl+V (⌘V en Mac)." : "No se pudo copiar.");
      else if (kind === "sheets-open") {
        const ok = await copyText(FO.toTSV(list));
        window.open("https://sheets.new", "_blank", "noopener");
        flash(ok ? "Copiado (" + n + "). En la hoja nueva pegá con Ctrl+V (⌘V en Mac)." : "No se pudo copiar.");
      }
    }

    function renderTypeOptions(all) {
      const counts = {};
      for (const it of all) counts[it.type] = (counts[it.type] || 0) + 1;
      typeSel.replaceChildren(h("option", { value: "all", text: "Todos (" + all.length + ")" }));
      for (const t of Object.keys(TYPE_NAMES)) {
        if (counts[t] || S.type === t) typeSel.append(h("option", { value: t, text: TYPE_NAMES[t] + " (" + (counts[t] || 0) + ")" }));
      }
      typeSel.value = S.type;
    }

    function mainMetric(it) {
      const key = S.sortKey === "newest" || S.sortKey === "oldest" || S.sortKey === "feed" ? "date" : S.sortKey;
      const v = key === "date" ? it.date : it[key];
      return h("span", { class: "main" }, icon(key), v == null ? "—" : fmt[key](v));
    }

    function tile(it, rank) {
      const href = U.safeUrl(it.url, adapter.linkHosts);
      const thumb = U.safeUrl(it.thumb);
      const m = (name, v) => (v == null ? null : h("div", null, icon(name), fmt[name](v)));
      const el = h(
        "a",
        {
          class: "tile" + (S.selected.has(it.id) ? " sel" : ""),
          href,
          target: "_blank",
          rel: "noopener noreferrer",
          title: it.text ? it.text.slice(0, 300) : null,
          onclick: (e) => {
            if (!S.selecting) return;
            e.preventDefault();
            if (S.selected.has(it.id)) S.selected.delete(it.id);
            else S.selected.add(it.id);
            el.classList.toggle("sel");
            renderHeader();
          },
        },
        thumb ? h("img", { src: thumb, loading: "lazy", alt: (it.text || "").slice(0, 120) }) : h("div", { class: "txt", text: it.text || "(sin texto)" }),
        h("span", { class: "shade" }),
        h("span", { class: "rank", text: "#" + rank }),
        it.type === "reel" || it.type === "video" ? h("span", { class: "kind", title: TYPE_NAMES[it.type] }, icon("reel")) : it.type === "carousel" ? h("span", { class: "kind", title: "Carrusel" }, icon("carousel")) : null,
        mainMetric(it),
        h(
          "span",
          { class: "hover" },
          m("views", it.views),
          m("likes", it.likes),
          m("comments", it.comments),
          m("shares", it.shares),
          m("velocity", it.velocity),
          m("outlier", it.outlier),
          it.date ? h("div", { class: "d", text: fmt.date(it.date) + (it.dateEstimated ? " (estimada)" : "") + (it.duration ? " · " + fmt.duration(it.duration) : "") + (it.author ? " · @" + it.author : "") }) : null
        ),
        h("span", { class: "pick" }, icon("check"))
      );
      return el;
    }

    // ---- table view ----
    const COLS = [
      ["rank", "#", null],
      ["thumb", "", null],
      ["date", "Fecha", "newest"],
      ["type", "Tipo", null],
      ["views", "Vistas", "views"],
      ["velocity", "Vistas/día", "velocity"],
      ["likes", "Likes", "likes"],
      ["comments", "Coment.", "comments"],
      ["shares", "Compart.", "shares"],
      ["engagement", "Engagement", "engagement"],
      ["outlier", "Outlier", "outlier"],
      ["duration", "Duración", null],
      ["text", "Texto", null],
    ];
    function table(list) {
      const head = h(
        "tr",
        null,
        COLS.map(([k, label, sortKey]) =>
          h("th", {
            class: (k === "text" || k === "type" || k === "thumb" || k === "rank" ? "l" : "") + (sortKey && (S.sortKey === sortKey || (sortKey === "newest" && S.sortKey === "oldest")) ? " on" : ""),
            text: label + (sortKey && (S.sortKey === sortKey || (sortKey === "newest" && S.sortKey === "oldest")) ? (currentDir() === "desc" ? " ↓" : " ↑") : ""),
            title: sortKey ? "Ordenar por " + label.toLowerCase() : null,
            onclick: sortKey ? () => (S.sortKey === sortKey ? update({ dir: currentDir() === "desc" ? "asc" : "desc" }) : update({ sortKey, dir: null })) : null,
          })
        )
      );
      const rows = list.map((it, i) => {
        const thumb = U.safeUrl(it.thumb);
        const val = (k) => (it[k] == null ? "—" : fmt[k](it[k]));
        const tr = h(
          "tr",
          {
            class: S.selected.has(it.id) ? "sel" : null,
            onclick: () => {
              if (S.selecting) {
                if (S.selected.has(it.id)) S.selected.delete(it.id);
                else S.selected.add(it.id);
                tr.classList.toggle("sel");
                renderHeader();
                return;
              }
              const href = U.safeUrl(it.url, adapter.linkHosts);
              if (href) window.open(href, "_blank", "noopener");
            },
          },
          h("td", { class: "l", text: String(i + 1) }),
          h("td", { class: "l th" }, thumb ? h("img", { src: thumb, loading: "lazy", alt: "" }) : null),
          h("td", { text: it.date ? fmt.date(it.date) + (it.dateEstimated ? "*" : "") : "—", title: it.dateEstimated ? "Fecha estimada a partir del número de la publicación" : null }),
          h("td", { class: "l", text: TYPE_NAMES[it.type] || it.type }),
          h("td", { text: val("views") }),
          h("td", { text: val("velocity") }),
          h("td", { text: val("likes") }),
          h("td", { text: val("comments") }),
          h("td", { text: val("shares") }),
          h("td", { text: val("engagement") }),
          h("td", { text: val("outlier") }),
          h("td", { text: val("duration") }),
          h("td", { class: "l txt", text: (it.text || "").replace(/\s+/g, " ").slice(0, 120) })
        );
        return tr;
      });
      return h("table", { class: "t" }, h("thead", null, head), h("tbody", null, rows));
    }

    // ---- summary view ----
    function stat(k, v, hint) {
      return h("div", { class: "stat" }, h("div", { class: "k", text: k }), h("div", { class: "v", text: v }), hint ? h("div", { class: "h", text: hint }) : null);
    }
    function chartCard(title, hint, body, wide) {
      return h("div", { class: "chart" + (wide ? " wide" : "") }, h("h3", { text: title }), hint ? h("div", { class: "h", text: hint }) : null, body);
    }
    function summary(list) {
      const st = FO.stats.summarize(list);
      const metricName = st.metric === "views" ? "vistas" : "likes";
      const fmtM = (v) => compact(Math.round(v));
      const parts = [
        h(
          "div",
          { class: "tiles" },
          stat("Publicaciones", full.format(st.count), st.first ? "del " + fmt.date(st.first) + " al " + fmt.date(st.last) : null),
          stat("Mediana de " + metricName, st.medianMetric == null ? "—" : fmtM(st.medianMetric), "la mitad está por encima"),
          stat("Vistas por día", st.medianVelocity == null ? "—" : fmt.velocity(st.medianVelocity), "mediana desde que se publicó"),
          stat("Engagement", st.medianEngagement == null ? "—" : fmt.engagement(st.medianEngagement), "mediana de (likes + comentarios) / vistas"),
          stat("Frecuencia", st.postsPerWeek == null ? "—" : oneDec.format(st.postsPerWeek), (st.postsPerWeek == null ? "" : "publicaciones por semana") + (st.lastPostDaysAgo == null ? "" : " · última " + ago(Date.now() - st.lastPostDaysAgo * DAY)))
        ),
      ];
      const charts = h("div", { class: "charts" });
      // Chart widths from the real layout (two columns when there is room), so text keeps its size.
      const inner = Math.max(300, (summaryBox.clientWidth || 900) - 32);
      const cols = inner >= 2 * 330 + 14 ? 2 : 1;
      const wideW = inner - 28;
      const halfW = (inner - (cols - 1) * 14) / cols - 28;
      if (st.timeline.length >= 2) {
        charts.append(
          chartCard(
            "Cada publicación en el tiempo",
            metricName.charAt(0).toUpperCase() + metricName.slice(1) + " por publicación, escala logarítmica. Tocá un punto para abrirla.",
            FO.charts.scatter(st.timeline, {
              width: wideW,
              title: metricName + " por publicación en el tiempo",
              fmt: fmtM,
              fmtDate: (x) => fmt.date(x),
              onOpen: (it) => {
                const href = U.safeUrl(it.url, adapter.linkHosts);
                if (href) window.open(href, "_blank", "noopener");
              },
            }),
            true
          )
        );
      }
      const dayName = { lun: "lunes", mar: "martes", "mié": "miércoles", jue: "jueves", vie: "viernes", "sáb": "sábado", dom: "domingo" };
      charts.append(
        chartCard("Según el día de publicación", "Mediana de " + metricName + " de lo publicado cada día.", FO.charts.columns(st.byWeekday, { width: halfW, fmt: fmtM, title: "Mediana de " + metricName + " por día", titleFor: (r) => dayName[r.label] || r.label })),
        chartCard("Según la hora de publicación", "Mediana de " + metricName + " por hora (hora de tu compu).", FO.charts.columns(st.byHour, { width: halfW, fmt: fmtM, labelEvery: 3, title: "Mediana de " + metricName + " por hora", titleFor: (r) => r.label + ":00 a " + r.label + ":59" }))
      );
      if (st.hashtags.length) {
        charts.append(
          chartCard(
            "Hashtags que mejor rinden",
            "Mediana de " + metricName + " de las publicaciones con cada hashtag (cantidad entre paréntesis).",
            FO.charts.rows(st.hashtags.map((t) => ({ label: t.label, value: t.value, note: "(" + t.n + ")" })), { fmt: fmtM })
          )
        );
      }
      parts.push(charts);
      if (st.estimatedDates) parts.push(h("div", { class: "h", style: null, text: "* Algunas fechas son estimadas a partir del número de la publicación, porque la red no las mandó." }));
      if (!list.length) return [h("div", { class: "empty", text: "Ninguna publicación coincide con los filtros." })];
      return parts;
    }

    function renderStatus() {
      const li = S.loadInfo;
      const parts = [];
      if (li && li.at) parts.push(h("span", { text: (li.fromCache ? "Datos guardados " : "Cargado ") + ago(li.at) }));
      if (li && li.message && !li.fromCache) parts.push(h("span", { class: li.reason === "ratelimit" || li.reason === "error" || li.reason === "timeout" ? "warn" : null, text: li.message }));
      if (opts.onRefresh) parts.push(h("button", { title: "Vuelve a cargar las publicaciones desde la red", onclick: () => refresh() }, icon("refresh"), "Actualizar datos"));
      statusLine.replaceChildren(...parts);
    }
    function refresh() {
      const filter = S.limit ? { mode: "posts", limit: S.limit } : S.baseFrom != null || S.baseTo != null ? { mode: "date", preset: "custom", from: S.baseFrom, to: S.baseTo } : { mode: "posts", limit: 0 };
      hideResults();
      opts.onRefresh({ sortKey: S.sortKey, filter });
    }

    let lastList = [];
    function renderHeader() {
      const nounCap = S.noun.charAt(0).toUpperCase() + S.noun.slice(1);
      const fem = S.noun === "publicaciones";
      titleEl.textContent = nounCap + " " + (TITLES[S.sortKey] || TITLES.views)[fem ? 1 : 0];
      const total = store.query({ ctx: S.ctx, limit: S.limit, from: S.baseFrom, to: S.baseTo, sortKey: "feed" }).length;
      subEl.replaceChildren(
        "Mostrando ",
        h("b", { text: full.format(lastList.length) }),
        " " + S.noun + (lastList.length !== total ? " de " + full.format(total) : "")
      );
      const selN = S.selected.size;
      exportBtn.replaceChildren(icon("exportIcon"), "Exportar", h("span", { class: "n", text: String(S.selecting ? selN : lastList.length) }));
      exportBtn.disabled = S.selecting ? selN === 0 : lastList.length === 0;
      const dlN = S.selecting ? selN : Math.min(TOP_DOWNLOADS, lastList.length);
      downloadBtn.replaceChildren(icon("download"), S.selecting || lastList.length < TOP_DOWNLOADS ? "Descargar" : "Descargar top", h("span", { class: "n", text: String(dlN) }));
      downloadBtn.disabled = dlN === 0 || !!dl.job || !!dl.preparing;
      downloadBtn.title = "Descarga los videos y fotos a Descargas/Valkiria";
      cancelSelBtn.style.display = S.selecting ? "" : "none";
      selectBtn.classList.toggle("on", S.selecting);
      card.classList.toggle("selecting", S.selecting);
      saveBtn.style.display = S.selecting ? "" : "none";
      saveBtn.disabled = selN === 0;
      for (const v in viewBtns) viewBtns[v].setAttribute("aria-pressed", String(S.view === v));
    }

    function render() {
      if (!S.open) return;
      sortSel.value = S.sortKey;
      dirBtn.replaceChildren(document.createTextNode(currentDir() === "desc" ? "↓" : "↑"));
      dirBtn.title = currentDir() === "desc" ? "De mayor a menor (tocá para invertir)" : "De menor a mayor (tocá para invertir)";
      fromIn.value = toInput(S.from);
      toIn.value = toInput(S.to);
      if (minIn.value !== String(S.minViews)) minIn.value = S.minViews;
      if (qIn.value !== S.query) qIn.value = S.query;
      durSel.value = S.dur;
      const all = store.query({ ctx: S.ctx, limit: S.limit, from: S.baseFrom, to: S.baseTo, sortKey: "feed" });
      renderTypeOptions(all);
      lastList = store.query(queryOpts());
      const visible = lastList.slice(0, S.shown);
      const tall = visible.length && visible.filter((i) => i.type === "reel" || i.type === "video").length / visible.length >= 0.7;
      grid.classList.toggle("tall", !!tall);
      grid.style.display = S.view === "grid" ? "" : "none";
      tableBox.style.display = S.view === "table" ? "" : "none";
      summaryBox.style.display = S.view === "summary" ? "" : "none";
      grid.replaceChildren();
      tableBox.replaceChildren();
      summaryBox.replaceChildren();
      if (S.view === "grid") grid.replaceChildren(...visible.map((it, i) => tile(it, i + 1)));
      else if (S.view === "table") tableBox.replaceChildren(table(visible));
      else summaryBox.replaceChildren(...summary(lastList));
      const target = S.view === "grid" ? grid : S.view === "table" ? tableBox : summaryBox;
      if (!all.length) target.replaceChildren(h("div", { class: "empty", text: "No se encontraron publicaciones en esta página. Abrí un perfil, una búsqueda o un hashtag y probá de nuevo." }));
      else if (!lastList.length) target.replaceChildren(h("div", { class: "empty", text: "Ninguna publicación coincide con los filtros." }));
      renderStatus();
      more.replaceChildren();
      const paged = S.view !== "summary" && lastList.length > visible.length;
      more.style.display = paged ? "" : "none";
      if (paged) {
        more.append(h("button", { class: "b outline", text: "Mostrar " + Math.min(PAGE_SIZE, lastList.length - visible.length) + " más", onclick: () => { S.shown += PAGE_SIZE; render(); } }));
      }
      renderHeader();
    }

    /** params: { ctx, sortKey, limit, from, to, noun } */
    function showResults(params) {
      root.className = "fo " + (pageIsDark() ? "dark" : "light");
      Object.assign(S, {
        open: true,
        ctx: params.ctx,
        sortKey: params.sortKey || "views",
        dir: null,
        limit: params.limit || null,
        from: params.from == null ? null : params.from,
        to: params.to == null ? null : params.to,
        baseFrom: params.from == null ? null : params.from,
        baseTo: params.to == null ? null : params.to,
        noun: params.noun || "publicaciones",
        loadInfo: params.loadInfo || null,
        dur: "all",
        type: "all",
        minViews: "",
        query: "",
        shown: PAGE_SIZE,
        selecting: false,
      });
      S.selected.clear();
      results.classList.add("on");
      results.scrollTop = 0;
      render();
      try {
        results.focus();
      } catch (_) {}
    }
    function hideResults() {
      S.open = false;
      results.classList.remove("on");
      menu.classList.remove("on");
    }

    let queued = false;
    store.onChange(() => {
      if (!S.open || queued) return;
      queued = true;
      setTimeout(() => {
        queued = false;
        render();
      }, 300);
    });

    function mount() {
      if (!host.isConnected) (document.body || document.documentElement).appendChild(host);
    }

    return {
      host,
      mount,
      showLoading,
      updateLoading,
      hideLoading,
      showResults,
      hideResults,
      isOpen: () => S.open,
      lastParams: () => (S.ctx == null ? null : { ctx: S.ctx, sortKey: S.sortKey, limit: S.limit, from: S.baseFrom, to: S.baseTo, noun: S.noun, loadInfo: S.loadInfo }),
    };
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
