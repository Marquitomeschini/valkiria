"use strict";
// Valkiria's own page: saved profiles, comparison and collections. Everything comes from
// chrome.storage.local (see core/cache.js); nothing leaves the browser.

const FO = window.FO;
document.head.appendChild(Object.assign(document.createElement("style"), { textContent: FO.charts.CSS }));
const PLATFORM = { instagram: "Instagram", tiktok: "TikTok", x: "X", facebook: "Facebook" };
const COLORS = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)"];
const MAX_COMPARE = 3;
const LINK_HOSTS = ["instagram.com", "tiktok.com", "x.com", "twitter.com", "facebook.com"];

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}
const full = new Intl.NumberFormat("es-AR");
const oneDec = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
function compact(n) {
  if (n == null) return "—";
  const a = Math.abs(n);
  if (a < 1000) return full.format(Math.round(n));
  if (a < 1e6) return oneDec.format(n / 1e3) + " k";
  if (a < 1e9) return oneDec.format(n / 1e6) + " M";
  return oneDec.format(n / 1e9) + " B";
}
const dateFmt = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" });
function ago(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 60) return "hace " + Math.max(1, m) + " min";
  const hh = Math.round(m / 60);
  return hh < 48 ? "hace " + hh + " h" : "hace " + Math.round(hh / 24) + " días";
}
function flash(text) {
  const n = document.getElementById("note");
  n.textContent = text;
  n.classList.add("on");
  clearTimeout(flash.t);
  flash.t = setTimeout(() => n.classList.remove("on"), 3000);
}
function profileUrl(platform, ctx) {
  if (!ctx || ctx.includes(":") || ctx === "home") return null;
  const base = { instagram: "https://www.instagram.com/", tiktok: "https://www.tiktok.com/", x: "https://x.com/", facebook: "https://www.facebook.com/" }[platform];
  return base ? base + ctx.split("/").map(encodeURIComponent).join("/") + (platform === "instagram" ? "/" : "") : null;
}
function safeLink(u) {
  return FO.util.safeUrl(u, LINK_HOSTS);
}
// Saved posts + derived metrics (engagement, outlier, views per day), most viewed first.
function withMetrics(items) {
  const s = new FO.Store();
  s.restore(items, "x");
  return s.query({ ctx: "x", sortKey: "views" });
}
function download(data, mime, name) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = h("a", { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
function exportList(items, base, kind) {
  const list = withMetrics(items);
  const safe = base.replace(/[^\w@.-]+/g, "_").slice(0, 60);
  if (kind === "csv") download(FO.toCSV(list), "text/csv;charset=utf-8", `valkiria_${safe}.csv`);
  else if (kind === "xlsx") download(FO.toXLSX(list), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `valkiria_${safe}.xlsx`);
  else download(FO.toJSON(list), "application/json", `valkiria_${safe}.json`);
}
function exportPicker(getItems, base) {
  const sel = h(
    "select",
    { "aria-label": "Exportar", onchange: async () => {
      const kind = sel.value;
      sel.value = "";
      if (kind) exportList(await getItems(), base, kind);
    } },
    h("option", { value: "", text: "Exportar…" }),
    h("option", { value: "xlsx", text: "Excel (.xlsx)" }),
    h("option", { value: "csv", text: "CSV" }),
    h("option", { value: "json", text: "JSON" })
  );
  return sel;
}

// ---------------- tabs ----------------
let current = "perfiles";
function showTab(name) {
  if (!["perfiles", "comparar", "colecciones"].includes(name)) name = "perfiles";
  current = name;
  for (const b of document.querySelectorAll("nav button")) b.setAttribute("aria-selected", String(b.dataset.tab === name));
  for (const s of document.querySelectorAll("main section")) s.hidden = s.id !== name;
  if (location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
  render();
}
function render() {
  if (current === "perfiles") renderPerfiles();
  else if (current === "comparar") renderComparar();
  else renderColecciones();
}

// ---------------- saved profiles ----------------
async function renderPerfiles() {
  const sec = document.getElementById("perfiles");
  const list = await FO.cache.list();
  const head = [h("h2", { text: "Perfiles guardados" }), h("p", { class: "sub", text: "Cada perfil, búsqueda o hashtag que cargás queda guardado acá y se abre al instante la próxima vez. Se guardan los últimos 40." })];
  if (!list.length) return sec.replaceChildren(...head, h("div", { class: "card empty", text: "Todavía no cargaste ningún perfil. Abrí uno en Instagram, TikTok, X o Facebook y usá el escudo de Valkiria." }));
  const rows = list.map((e) => {
    const url = profileUrl(e.platform, e.ctx);
    return h(
      "div",
      { class: "item" },
      h("div", { class: "grow" }, h("div", { class: "name", text: (PLATFORM[e.platform] || e.platform) + " · " + e.label }), h("div", { class: "meta", text: full.format(e.count) + " publicaciones · guardado " + ago(e.savedAt) + (e.complete ? " · completo" : " · parcial") })),
      url ? h("a", { class: "b", href: url, target: "_blank", rel: "noopener noreferrer", text: "Abrir" }) : null,
      exportPicker(async () => (await FO.cache.loadKey(e.key)).items, e.platform + "_" + e.ctx),
      h("button", { class: "b danger", text: "Borrar", onclick: async () => {
        if (!confirm("¿Borrar lo guardado de " + e.label + "?")) return;
        await FO.cache.remove(e.key);
        flash("Borrado.");
      } })
    );
  });
  sec.replaceChildren(...head, h("div", { class: "card list" }, rows));
}

// ---------------- compare ----------------
const picked = new Set();
async function renderComparar() {
  const sec = document.getElementById("comparar");
  const list = await FO.cache.list();
  const head = [h("h2", { text: "Comparar perfiles" }), h("p", { class: "sub", text: "Elegí hasta " + MAX_COMPARE + " perfiles guardados. Todos los valores son medianas: la mitad de las publicaciones está por encima." })];
  if (!list.length) return sec.replaceChildren(...head, h("div", { class: "card empty", text: "Primero cargá algunos perfiles con Valkiria: aparecen acá para compararlos." }));
  for (const k of [...picked]) if (!list.some((e) => e.key === k)) picked.delete(k);
  if (!picked.size) list.slice(0, Math.min(2, list.length)).forEach((e) => picked.add(e.key));
  const chooser = h(
    "div",
    { class: "card list" },
    list.map((e) =>
      h(
        "label",
        { class: "pick item" },
        h("input", {
          type: "checkbox",
          checked: picked.has(e.key),
          disabled: !picked.has(e.key) && picked.size >= MAX_COMPARE,
          onchange: (ev) => {
            if (ev.target.checked) picked.add(e.key);
            else picked.delete(e.key);
            renderComparar();
          },
        }),
        h("span", { class: "grow" }, h("span", { class: "name", text: (PLATFORM[e.platform] || e.platform) + " · " + e.label }), " ", h("span", { class: "chip", text: full.format(e.count) + " publicaciones" }))
      )
    )
  );
  const entries = (await Promise.all([...picked].map((k) => FO.cache.loadKey(k)))).filter(Boolean);
  const profiles = entries.map((e, i) => {
    const items = withMetrics(e.items);
    return { e, items, st: FO.stats.summarize(items), color: COLORS[i], name: e.label + " (" + (PLATFORM[e.platform] || e.platform) + ")" };
  });
  const out = [...head, chooser];
  if (profiles.length) {
    const metric = (p) => p.st.metric;
    const bestOf = (rows) => {
      const b = rows.filter((r) => r.n >= 2 && r.value != null).sort((a, z) => z.value - a.value)[0];
      return b ? b.label : "—";
    };
    const days = { lun: "lunes", mar: "martes", "mié": "miércoles", jue: "jueves", vie: "viernes", "sáb": "sábado", dom: "domingo" };
    const METRICS = [
      ["Publicaciones", (p) => full.format(p.st.count)],
      ["Mediana de vistas", (p) => compact(p.st.medianViews)],
      ["Mediana de likes", (p) => compact(p.st.medianLikes)],
      ["Vistas por día", (p) => (p.st.medianVelocity == null ? "—" : compact(p.st.medianVelocity) + "/día")],
      ["Engagement", (p) => (p.st.medianEngagement == null ? "—" : oneDec.format(p.st.medianEngagement * 100) + " %")],
      ["Frecuencia", (p) => (p.st.postsPerWeek == null ? "—" : oneDec.format(p.st.postsPerWeek) + " por semana")],
      ["Mejor día", (p) => days[bestOf(p.st.byWeekday)] || "—"],
      ["Mejor hora", (p) => {
        const b = bestOf(p.st.byHour);
        return b === "—" ? b : b + " h";
      }],
    ];
    const legend = FO.charts.legend(profiles.map((p) => ({ label: p.name, color: p.color })));
    const tbl = h(
      "table",
      { class: "t" },
      h("thead", null, h("tr", null, h("th", { text: "" }), profiles.map((p) => h("th", { text: p.e.label })))),
      h("tbody", null, METRICS.map(([label, f]) => h("tr", null, h("td", { text: label }), profiles.map((p) => h("td", { text: f(p) })))))
    );
    const bars = (title, get, fmtV) =>
      h("div", { class: "chart" }, h("h3", { text: title }), FO.charts.rows(profiles.map((p) => ({ label: p.e.label, value: get(p), color: p.color })), { fmt: fmtV }));
    const charts = h(
      "div",
      { class: "charts" },
      bars("Mediana de vistas", (p) => p.st.medianViews, compact),
      bars("Vistas por día", (p) => p.st.medianVelocity, (v) => compact(v) + "/día"),
      bars("Engagement", (p) => p.st.medianEngagement, (v) => oneDec.format(v * 100) + " %"),
      bars("Publicaciones por semana", (p) => p.st.postsPerWeek, (v) => oneDec.format(v))
    );
    // Each profile's best posts by its own main metric (views, or likes for photo-heavy pages).
    const tops = h(
      "div",
      { class: "charts" },
      profiles.map((p) => {
        const key = metric(p) === "views" ? "views" : "likes";
        const best = p.items.filter((it) => it[key] != null).sort((a, z) => z[key] - a[key]).slice(0, 5);
        return h(
          "div",
          { class: "chart" },
          h("h3", { text: "Lo mejor de " + p.e.label + " · por " + (key === "views" ? "vistas" : "likes") }),
          h(
            "div",
            { class: "top5" },
            best.map((it, i) =>
              h("a", { href: safeLink(it.url), target: "_blank", rel: "noopener noreferrer" }, h("span", { text: String(i + 1) }), h("span", { class: "t", text: (it.text || "(sin texto)").replace(/\s+/g, " ") }), h("span", { text: compact(it[key]) }))
            )
          )
        );
      })
    );
    out.push(h("div", { class: "card" }, legend, tbl), charts, h("h2", { text: "Las 5 mejores publicaciones de cada uno" }), tops);
  }
  sec.replaceChildren(...out);
}

// ---------------- collections ----------------
let openCollection = null;
async function renderColecciones() {
  const sec = document.getElementById("colecciones");
  const all = await FO.collections.all();
  const names = Object.keys(all).sort((a, b) => (all[b].updated || 0) - (all[a].updated || 0));
  const head = [h("h2", { text: "Colecciones" }), h("p", { class: "sub", text: "Para guardar: en los resultados de Valkiria tocá Seleccionar, marcá publicaciones y tocá Guardar." })];
  if (!names.length) return sec.replaceChildren(...head, h("div", { class: "card empty", text: "Todavía no guardaste publicaciones." }));
  if (openCollection && !all[openCollection]) openCollection = null;
  if (!openCollection) {
    const rows = names.map((n) =>
      h(
        "div",
        { class: "item" },
        h("div", { class: "grow" }, h("div", { class: "name", text: n }), h("div", { class: "meta", text: all[n].items.length + " publicaciones · actualizada " + ago(all[n].updated || all[n].created) })),
        h("button", { class: "b", text: "Ver", onclick: () => { openCollection = n; renderColecciones(); } }),
        exportPicker(async () => (await FO.collections.all())[n].items, "coleccion_" + n)
      )
    );
    return sec.replaceChildren(...head, h("div", { class: "card list" }, rows));
  }
  const c = all[openCollection];
  const items = withMetrics(c.items);
  const grid = h(
    "div",
    { class: "grid" },
    items.map((it) => {
      const thumb = FO.util.safeUrl(it.thumb);
      const link = safeLink(it.url);
      const img = thumb ? h("img", { src: thumb, loading: "lazy", alt: "" }) : null;
      const fallback = h("div", { class: "txt", text: it.text || "(sin texto)" });
      if (img) img.addEventListener("error", () => img.replaceWith(fallback)); // CDN links expire after a while
      return h(
        "div",
        { class: "post" },
        h("a", { class: "pic", href: link, target: "_blank", rel: "noopener noreferrer" }, img || fallback),
        h(
          "div",
          { class: "info" },
          h("div", { class: "m", text: [it.views != null ? compact(it.views) + " vistas" : null, it.likes != null ? compact(it.likes) + " likes" : null].filter(Boolean).join(" · ") || "—" }),
          h("div", { class: "who", text: (PLATFORM[it.platform] || it.platform) + (it.author ? " · @" + it.author : "") + (it.date ? " · " + dateFmt.format(new Date(it.date)) : "") }),
          h("button", { text: "Quitar", onclick: async () => {
            await FO.collections.removeItem(openCollection, it.platform, it.id);
            flash("Quitada de la colección.");
          } })
        )
      );
    })
  );
  sec.replaceChildren(
    ...head,
    h(
      "div",
      { class: "card" },
      h(
        "div",
        { class: "row" },
        h("button", { class: "b", text: "← Colecciones", onclick: () => { openCollection = null; renderColecciones(); } }),
        h("h2", { class: "grow", text: openCollection + " (" + items.length + ")" }),
        exportPicker(async () => (await FO.collections.all())[openCollection].items, "coleccion_" + openCollection),
        h("button", { class: "b danger", text: "Borrar colección", onclick: async () => {
          if (!confirm("¿Borrar la colección «" + openCollection + "»?")) return;
          await FO.collections.removeCollection(openCollection);
          openCollection = null;
          flash("Colección borrada.");
        } })
      )
    ),
    items.length ? grid : h("div", { class: "card empty", text: "La colección está vacía." })
  );
}

// ---------------- start ----------------
for (const b of document.querySelectorAll("nav button")) b.addEventListener("click", () => showTab(b.dataset.tab));
window.addEventListener("hashchange", () => showTab(location.hash.slice(1)));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && Object.keys(changes).some((k) => k.startsWith("fo_cache") || k === "fo_collections")) render();
});
showTab(location.hash.slice(1) || "perfiles");
