(function (root) {
  "use strict";
  const FO = (root.FO = root.FO || {});

  const COLUMNS = [
    ["plataforma", (it) => it.platform],
    ["url", (it) => it.url],
    ["autor", (it) => it.author],
    ["fecha", (it) => fmtDate(it.date)],
    ["tipo", (it) => it.type],
    ["vistas", (it) => it.views],
    ["likes", (it) => it.likes],
    ["comentarios", (it) => it.comments],
    ["compartidos", (it) => it.shares],
    ["guardados", (it) => it.saves],
    ["engagement_%", (it) => (it.engagement == null ? null : round(it.engagement * 100, 2))],
    ["outlier_x", (it) => (it.outlier == null ? null : round(it.outlier, 2))],
    ["texto", (it) => (it.text ? it.text.replace(/\s+/g, " ").trim() : null)],
  ];

  function round(n, d) {
    const f = Math.pow(10, d);
    return Math.round(n * f) / f;
  }

  function fmtDate(ms) {
    if (ms == null) return null;
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  // Spreadsheets in Spanish use a decimal comma.
  function decimal(v) {
    return typeof v === "number" && !Number.isInteger(v) ? String(v).replace(".", ",") : v;
  }

  function guardFormula(s) {
    return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; // prevent spreadsheet formula injection
  }

  // ---- CSV (semicolon, UTF-8 with BOM: opens in columns in Excel/Sheets set to Spanish) ----
  function csvCell(v) {
    if (v === null || v === undefined) return "";
    const s = guardFormula(String(decimal(v)));
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  FO.toCSV = function (items) {
    const rows = [COLUMNS.map((c) => c[0]).join(";")];
    for (const it of items) rows.push(COLUMNS.map((c) => csvCell(c[1](it))).join(";"));
    return "\uFEFF" + rows.join("\r\n") + "\r\n";
  };

  // ---- TSV for pasting into Google Sheets / Excel ----
  FO.toTSV = function (items) {
    const cell = (v) => (v === null || v === undefined ? "" : guardFormula(String(decimal(v)).replace(/[\t\r\n]+/g, " ")));
    const rows = [COLUMNS.map((c) => c[0]).join("\t")];
    for (const it of items) rows.push(COLUMNS.map((c) => cell(c[1](it))).join("\t"));
    return rows.join("\n") + "\n";
  };

  // ---- JSON ----
  FO.toJSON = function (items) {
    const out = items.map((it) => {
      const o = {};
      for (const [name, get] of COLUMNS) {
        const v = get(it);
        o[name] = v === undefined ? null : v;
      }
      o.fecha_iso = it.date == null ? null : new Date(it.date).toISOString();
      return o;
    });
    return JSON.stringify(out, null, 2);
  };

  // ---- media downloads: Downloads/Valkiria/<platform>_<page>/<rank>_<type>_<id>[_n].<ext> ----
  function segment(s) {
    const out = String(s)
      .replace(/[\\/:*?"<>|~\u0000-\u001F]+/g, "_")
      .replace(/^[.\s]+|[.\s]+$/g, "")
      .slice(0, 80);
    return out || "x";
  }
  function extOf(url, kind) {
    let m = null;
    try {
      m = /\.(mp4|mov|webm|m4v|jpe?g|png|webp|heic|gif)$/i.exec(new URL(url).pathname);
    } catch (_) {}
    const ext = m ? m[1].toLowerCase() : kind === "video" ? "mp4" : "jpg";
    return ext === "jpeg" ? "jpg" : ext;
  }
  /** items in display order -> { files: [{ url, filename }], missing: posts without a downloadable file } */
  FO.mediaFiles = function (items, opts) {
    const folder = "Valkiria/" + segment((opts.platform || "red") + "_" + (opts.ctx || "todo"));
    const files = [];
    let missing = 0;
    items.forEach((it, i) => {
      const media = Array.isArray(it.media) ? it.media.filter((m) => m && /^https:\/\//.test(m.url)) : [];
      if (!media.length) {
        missing++;
        return;
      }
      media.forEach((m, k) => {
        const name = String(i + 1).padStart(3, "0") + "_" + segment(it.type || "post") + "_" + segment(it.id) + (media.length > 1 ? "_" + (k + 1) : "") + "." + extOf(m.url, m.kind);
        const f = { url: m.url, filename: folder + "/" + name };
        if (Array.isArray(m.alts) && m.alts.length) f.alts = m.alts.filter((u) => /^https:\/\//.test(u));
        if (m.via === "fetch") f.via = "fetch";
        files.push(f);
      });
    });
    return { files, missing, folder };
  };

  // ---- XLSX (a real Excel file: SpreadsheetML inside an uncompressed ZIP) ----
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  FO.zipStore = function (files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    const DOS_TIME = 0;
    const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true); // UTF-8 names
      lh.setUint16(8, 0, true); // stored
      lh.setUint16(10, DOS_TIME, true);
      lh.setUint16(12, DOS_DATE, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true);
      lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true);
      lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true);
      ch.setUint16(12, DOS_TIME, true);
      ch.setUint16(14, DOS_DATE, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true);
      ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((n, p) => n + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    const all = parts.concat(central, [new Uint8Array(end.buffer)]);
    const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
    let pos = 0;
    for (const p of all) {
      out.set(p, pos);
      pos += p.length;
    }
    return out;
  };

  function xmlText(s) {
    return String(s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function colName(i) {
    let s = "";
    for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    return s;
  }

  FO.toXLSX = function (items) {
    const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
    const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    const rows = [];
    const cell = (r, c, v, style) => {
      const ref = colName(c) + r;
      if (v === null || v === undefined || v === "") return "";
      if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${style ? ` s="${style}"` : ""}><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t xml:space="preserve">${xmlText(v)}</t></is></c>`;
    };
    rows.push(`<row r="1">${COLUMNS.map((c, i) => cell(1, i, c[0], 1)).join("")}</row>`);
    items.forEach((it, idx) => {
      const r = idx + 2;
      rows.push(`<row r="${r}">${COLUMNS.map((c, i) => cell(r, i, c[1](it))).join("")}</row>`);
    });
    const widths = [12, 48, 18, 17, 10, 12, 12, 13, 13, 11, 14, 11, 80];
    const cols = `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`;
    const sheet = `${head}<worksheet ${NS}><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${rows.join("")}</sheetData></worksheet>`;
    const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    return FO.zipStore([
      {
        name: "[Content_Types].xml",
        data: `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      },
      { name: "_rels/.rels", data: `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: "xl/workbook.xml", data: `${head}<workbook ${NS} xmlns:r="${R}"><sheets><sheet name="Valkiria" sheetId="1" r:id="rId1"/></sheets></workbook>` },
      {
        name: "xl/_rels/workbook.xml.rels",
        data: `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${R}/styles" Target="styles.xml"/></Relationships>`,
      },
      {
        name: "xl/styles.xml",
        data: `${head}<styleSheet ${NS}><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
      },
      { name: "xl/worksheets/sheet1.xml", data: sheet },
    ]);
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
