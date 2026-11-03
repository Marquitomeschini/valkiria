(function (root) {
  "use strict";
  const FO = (root.FO = root.FO || {});
  const NS = "http://www.w3.org/2000/svg";

  // Colors come from CSS variables set by the page/shadow root (validated palette, light + dark):
  // --viz-1..3 series, --viz-grid hairlines, --viz-surface chart background, --viz-text, --viz-muted.
  const CSS = `
.viz { position: relative; }
.viz svg { display: block; width: 100%; height: auto; overflow: visible; }
.viz .grid { stroke: var(--viz-grid); stroke-width: 1; }
.viz .axis { fill: var(--viz-muted); font: 11px system-ui, sans-serif; }
.viz .lbl { fill: var(--viz-text); font: 600 11.5px system-ui, sans-serif; }
.viz .bar { fill: var(--viz-1); }
.viz .hit { fill: transparent; cursor: default; outline: none; }
.viz .hit:hover + .bar, .viz .hit:focus + .bar, .viz .bar.on { filter: brightness(1.15); }
.viz .dot { fill: var(--viz-1); stroke: var(--viz-surface); stroke-width: 2; }
.viz .dot.on { r: 6; }
.viz .tip { position: absolute; pointer-events: none; z-index: 3; background: var(--viz-tip-bg); color: var(--viz-tip-fg); border-radius: 8px; padding: 7px 10px; font: 12px/1.35 system-ui, sans-serif; box-shadow: 0 6px 20px rgba(0,0,0,.25); white-space: nowrap; display: none; max-width: 260px; }
.viz .tip.on { display: block; }
.viz .tip b { display: block; font-size: 13.5px; }
.viz .tip span { opacity: .8; display: block; white-space: normal; }
.vrows { display: grid; grid-template-columns: minmax(70px, max-content) 1fr max-content; gap: 6px 10px; align-items: center; font: 12.5px system-ui, sans-serif; }
.vrows .rl { color: var(--viz-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
.vrows .rt { height: 12px; }
.vrows .rb { height: 12px; border-radius: 0 4px 4px 0; background: var(--viz-1); min-width: 2px; }
.vrows .rv { color: var(--viz-text); font-variant-numeric: tabular-nums; text-align: right; }
.vrows .rv small { color: var(--viz-muted); margin-left: 4px; }
.vlegend { display: flex; flex-wrap: wrap; gap: 6px 14px; font: 12px system-ui, sans-serif; color: var(--viz-text); margin-bottom: 8px; }
.vlegend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
`;

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function tipFor(box) {
    const tip = document.createElement("div");
    tip.className = "tip";
    box.appendChild(tip);
    return {
      show(x, y, strong, ...lines) {
        const b = document.createElement("b");
        b.textContent = strong;
        tip.replaceChildren(b, ...lines.filter(Boolean).map((l) => Object.assign(document.createElement("span"), { textContent: l })));
        tip.classList.add("on");
        const w = box.clientWidth;
        tip.style.left = Math.max(0, Math.min(x + 12, w - tip.offsetWidth)) + "px";
        tip.style.top = Math.max(0, y - tip.offsetHeight - 10) + "px";
      },
      hide() {
        tip.classList.remove("on");
      },
    };
  }
  // Position of an SVG point inside the box (the SVG is scaled to the box width).
  function toBox(svg, box, x, y) {
    const r = svg.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const k = r.width / svg.viewBox.baseVal.width || 1;
    return [r.left - b.left + x * k, r.top - b.top + y * k];
  }
  // Column with a 4px rounded data end and a square foot on the baseline.
  function columnPath(x, w, top, base) {
    const r = Math.min(4, w / 2, base - top);
    return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${base}Z`;
  }

  /**
   * Single-series columns. rows: [{ label, value, n }]; opts: { fmt, labelEvery, unit }
   * Only the highest column is labeled; every column has a hover/focus tooltip.
   */
  function columns(rows, opts) {
    const o = opts || {};
    const W = Math.max(280, Math.round(o.width || 640)); // drawn at its real width so text keeps its size
    const H = 170;
    const top = 22;
    const base = H - 24;
    const box = document.createElement("div");
    box.className = "viz";
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.title || "" }, box);
    const tip = tipFor(box);
    const max = Math.max(0, ...rows.map((r) => r.value || 0));
    const band = W / rows.length;
    const bw = Math.min(24, band * 0.62);
    el("line", { class: "grid", x1: 0, x2: W, y1: base + 0.5, y2: base + 0.5 }, svg);
    const best = rows.reduce((b, r, i) => (r.value != null && (b < 0 || r.value > rows[b].value) ? i : b), -1);
    rows.forEach((r, i) => {
      const x = i * band + (band - bw) / 2;
      const hgt = max && r.value ? Math.max(2, ((base - top) * r.value) / max) : 0;
      const hit = el("rect", { class: "hit", x: i * band, y: top - 10, width: band, height: base - top + 10, tabindex: 0 }, svg);
      const bar = hgt ? el("path", { class: "bar", d: columnPath(x, bw, base - hgt, base) }, svg) : null;
      const show = () => {
        const [px, py] = toBox(svg, box, x + bw / 2, base - hgt);
        if (bar) bar.classList.add("on");
        tip.show(px, py, r.value == null ? "Sin datos" : o.fmt(r.value), (o.titleFor ? o.titleFor(r) : r.label), r.n ? r.n + (r.n === 1 ? " publicación" : " publicaciones") : "");
      };
      const hide = () => {
        if (bar) bar.classList.remove("on");
        tip.hide();
      };
      hit.addEventListener("pointerenter", show);
      hit.addEventListener("pointerleave", hide);
      hit.addEventListener("focus", show);
      hit.addEventListener("blur", hide);
      if (!o.labelEvery || i % o.labelEvery === 0) {
        const t = el("text", { class: "axis", x: i * band + band / 2, y: H - 6, "text-anchor": "middle" }, svg);
        t.textContent = r.label;
      }
      if (i === best && hgt) {
        const t = el("text", { class: "lbl", x: x + bw / 2, y: base - hgt - 6, "text-anchor": "middle" }, svg);
        t.textContent = o.fmt(r.value);
      }
    });
    return box;
  }

  /** Horizontal bar list. rows: [{ label, value, color, note }] — values are written in a column. */
  function rowsChart(rows, opts) {
    const o = opts || {};
    const box = document.createElement("div");
    box.className = "vrows";
    const max = Math.max(0, ...rows.map((r) => r.value || 0));
    for (const r of rows) {
      const l = document.createElement("span");
      l.className = "rl";
      l.textContent = r.label;
      l.title = r.label;
      const track = document.createElement("span");
      track.className = "rt";
      const bar = document.createElement("span");
      bar.className = "rb";
      bar.style.width = max && r.value ? Math.max(1, (100 * r.value) / max) + "%" : "0";
      if (r.color) bar.style.background = r.color;
      bar.style.display = "block";
      track.appendChild(bar);
      const v = document.createElement("span");
      v.className = "rv";
      v.textContent = r.value == null ? "—" : o.fmt(r.value);
      if (r.note) {
        const n = document.createElement("small");
        n.textContent = r.note;
        v.appendChild(n);
      }
      box.append(l, track, v);
    }
    return box;
  }

  function legend(entries) {
    const box = document.createElement("div");
    box.className = "vlegend";
    for (const e of entries) {
      const s = document.createElement("span");
      const sw = document.createElement("i");
      sw.style.background = e.color;
      s.append(sw, e.label);
      box.appendChild(s);
    }
    return box;
  }

  /**
   * One dot per post over time, log scale (a few viral posts would flatten everything else).
   * points: [{ x: ms, y: value, item }]; opts: { fmt, fmtDate, onOpen }
   */
  function scatter(points, opts) {
    const o = opts || {};
    const W = Math.max(280, Math.round(o.width || 640));
    const H = 220;
    const L = 46;
    const R = 10;
    const T = 10;
    const B = H - 24;
    const box = document.createElement("div");
    box.className = "viz";
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.title || "" }, box);
    const tip = tipFor(box);
    const pts = points.filter((p) => p.y > 0);
    if (!pts.length) return box;
    const xs = pts.map((p) => p.x);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs) || x0 + 1;
    const ly = pts.map((p) => Math.log10(p.y));
    const y0 = Math.floor(Math.min(...ly));
    const y1 = Math.max(y0 + 1, Math.ceil(Math.max(...ly)));
    const sx = (x) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R);
    const sy = (v) => B - ((Math.log10(v) - y0) / (y1 - y0)) * (B - T);
    for (let e = y0; e <= y1; e++) {
      const y = sy(Math.pow(10, e));
      el("line", { class: "grid", x1: L, x2: W - R, y1: y + 0.5, y2: y + 0.5 }, svg);
      const t = el("text", { class: "axis", x: L - 6, y: y + 4, "text-anchor": "end" }, svg);
      t.textContent = o.fmt(Math.pow(10, e));
    }
    const ticks = x1 > x0 ? [x0, (x0 + x1) / 2, x1] : [x0];
    ticks.forEach((tx, i) => {
      const t = el("text", { class: "axis", x: sx(tx), y: H - 6, "text-anchor": i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle" }, svg);
      t.textContent = o.fmtDate(tx);
    });
    const dots = pts.map((p) => {
      const c = el("circle", { class: "dot", cx: sx(p.x), cy: sy(p.y), r: 4 }, svg);
      return { p, c, x: sx(p.x), y: sy(p.y) };
    });
    let on = null;
    const pick = (ev) => {
      const r = svg.getBoundingClientRect();
      const k = W / r.width;
      const mx = (ev.clientX - r.left) * k;
      const my = (ev.clientY - r.top) * k;
      let best = null;
      let bd = 18 * 18; // the hit area is bigger than the dot
      for (const d of dots) {
        const dd = (d.x - mx) ** 2 + (d.y - my) ** 2;
        if (dd < bd) {
          bd = dd;
          best = d;
        }
      }
      return best;
    };
    svg.addEventListener("pointermove", (ev) => {
      const d = pick(ev);
      if (on && on !== d) on.c.classList.remove("on");
      on = d;
      if (!d) return tip.hide();
      d.c.classList.add("on");
      const [px, py] = toBox(svg, box, d.x, d.y);
      const text = d.p.item && d.p.item.text ? d.p.item.text.replace(/\s+/g, " ").slice(0, 80) : "";
      tip.show(px, py, o.fmt(d.p.y), o.fmtDate(d.p.x) + (d.p.item && d.p.item.dateEstimated ? " (fecha estimada)" : ""), text);
      svg.style.cursor = o.onOpen ? "pointer" : "default";
    });
    svg.addEventListener("pointerleave", () => {
      if (on) on.c.classList.remove("on");
      on = null;
      tip.hide();
    });
    svg.addEventListener("click", (ev) => {
      const d = pick(ev);
      if (d && o.onOpen) o.onOpen(d.p.item);
    });
    return box;
  }

  FO.charts = { CSS, columns, rows: rowsChart, legend, scatter };
})(typeof globalThis !== "undefined" ? globalThis : this);
