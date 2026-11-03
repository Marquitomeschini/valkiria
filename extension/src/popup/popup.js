"use strict";

const PLATFORM_NAMES = { instagram: "Instagram", tiktok: "TikTok", x: "X", facebook: "Facebook" };
const $ = (id) => document.getElementById(id);
const prefs = { mode: "posts", limit: "0", preset: "all", from: "", to: "", lastSort: null };
let tabId = null;

function send(msg, id = tabId) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(id, msg, (res) => {
        void chrome.runtime.lastError; // no content script on this tab
        resolve(res || null);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

/** The tab to control: the active tab. (?pick=any is used by the automated tests, where the popup opens as a tab.) */
async function findTab() {
  if (new URLSearchParams(location.search).get("pick") === "any") {
    for (const t of await chrome.tabs.query({})) {
      const st = await send({ type: "fo:status" }, t.id);
      if (st && st.ok) return t.id;
    }
    return null;
  }
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t ? t.id : null;
}

function savePrefs() {
  chrome.storage.local.set({ fo_popup: prefs });
}

function renderFilters() {
  const posts = prefs.mode === "posts";
  $("modePosts").setAttribute("aria-selected", String(posts));
  $("modeDate").setAttribute("aria-selected", String(!posts));
  $("postsSel").hidden = !posts;
  $("dateSel").hidden = posts;
  $("postsSel").value = prefs.limit;
  $("dateSel").value = prefs.preset;
  $("custom").hidden = posts || prefs.preset !== "custom";
  $("from").value = prefs.from;
  $("to").value = prefs.to;
  for (const b of document.querySelectorAll("#sorts button")) b.classList.toggle("last", b.dataset.sort === prefs.lastSort);
}

function filter() {
  if (prefs.mode === "posts") return { mode: "posts", limit: Number(prefs.limit) || 0 };
  const f = { mode: "date", preset: prefs.preset };
  if (prefs.preset === "custom") {
    f.from = prefs.from ? new Date(prefs.from + "T00:00:00").getTime() : null;
    f.to = prefs.to ? new Date(prefs.to + "T23:59:59.999").getTime() : null;
  }
  return f;
}

function renderStatus(st) {
  const ok = !!(st && st.ok);
  $("unsupported").hidden = ok;
  $("main").hidden = !ok;
  $("where").textContent = ok ? PLATFORM_NAMES[st.platform] + " · " + st.label : "";
  $("where").title = $("where").textContent;
  for (const b of document.querySelectorAll("#sorts button")) b.disabled = !ok;
  $("diagrow").hidden = !ok;
  $("stop").hidden = !(ok && st.running);
  $("show").hidden = !(ok && !st.running && st.hasResults);
  $("status").textContent = !ok ? "" : st.running ? "Cargando… " + st.count + " " + st.noun : st.count ? st.count + " " + st.noun + " cargad" + (st.noun === "publicaciones" ? "as" : "os") : "";
}

async function refresh() {
  if (tabId == null) tabId = await findTab();
  renderStatus(tabId == null ? null : await send({ type: "fo:status" }));
}

document.querySelector(".seg").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  prefs.mode = b.dataset.mode;
  savePrefs();
  renderFilters();
});
$("postsSel").addEventListener("change", () => {
  prefs.limit = $("postsSel").value;
  savePrefs();
});
$("dateSel").addEventListener("change", () => {
  prefs.preset = $("dateSel").value;
  savePrefs();
  renderFilters();
});
for (const id of ["from", "to"]) {
  $(id).addEventListener("change", () => {
    prefs[id] = $(id).value;
    savePrefs();
  });
}
$("sorts").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-sort]");
  if (!b || b.disabled) return;
  prefs.lastSort = b.dataset.sort;
  savePrefs();
  renderFilters();
  await send({ type: "fo:run", sortKey: b.dataset.sort, filter: filter() });
  refresh();
});
$("show").addEventListener("click", () => send({ type: "fo:show" }));

// ---- version and updates (the Windows installer syncs the folder; Valkiria reloads itself) ----
const REPO = "Marquitomeschini/valkiria";
$("ver").textContent = "Versión " + chrome.runtime.getManifest().version + " ·";
$("checkupd").addEventListener("click", async () => {
  const msg = $("updmsg");
  msg.textContent = "Buscando…";
  const running = chrome.runtime.getManifest().version;
  const read = (url) => fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const latest = await read("https://raw.githubusercontent.com/" + REPO + "/main/extension/manifest.json");
  if (!latest || !latest.version) return (msg.textContent = "No pude consultar GitHub. Probá de nuevo en un rato.");
  if (latest.version === running) return (msg.textContent = "Tenés la última versión.");
  const disk = await read(chrome.runtime.getURL("manifest.json"));
  if (disk && disk.version !== running) {
    msg.textContent = "Aplicando la versión " + disk.version + "…";
    chrome.runtime.sendMessage({ type: "fo:apply-update" }).catch(() => {});
    return;
  }
  msg.textContent = "Hay una versión nueva (" + latest.version + "). Se instala sola en menos de 15 minutos, o abrí la carpeta Valkiria y hacé doble clic en «Actualizar ahora».";
});
$("diag").addEventListener("click", async () => {
  const res = await send({ type: "fo:diag" });
  if (!res || !res.ok) return ($("diagmsg").textContent = "No se pudo leer la página.");
  try {
    await navigator.clipboard.writeText(res.text);
    $("diagmsg").textContent = "Copiado. Pegalo en el chat.";
  } catch (_) {
    $("diagmsg").textContent = "No se pudo copiar.";
  }
});
$("stop").addEventListener("click", async () => {
  await send({ type: "fo:stop" });
  refresh();
});

chrome.storage.local.get("fo_popup", (res) => {
  Object.assign(prefs, (res && res.fo_popup) || {});
  renderFilters();
});
// "Valkiria se actualizó": shown once after a self-update, then the badge is cleared.
chrome.storage.local.get("fo_updated", (res) => {
  const u = res && res.fo_updated;
  if (!u || u.seen || Date.now() - u.at > 7 * 86400000) return;
  const box = $("updated");
  box.replaceChildren("Valkiria se actualizó a la versión " + u.to + ".", Object.assign(document.createElement("small"), { textContent: "Recargá las pestañas de Instagram, TikTok, X o Facebook que tengas abiertas." }));
  box.hidden = false;
  chrome.storage.local.set({ fo_updated: Object.assign({}, u, { seen: true }) });
  chrome.action.setBadgeText({ text: "" });
});

renderFilters();
refresh();
setInterval(refresh, 600);
