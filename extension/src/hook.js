// Valkiria: runs in the page's MAIN world at document_start.
// It only *copies* API responses the site already requested and hands them to
// the extension's isolated content script. It never changes requests or responses.
(function () {
  "use strict";
  if (window.__valkiriaHooked) return;
  window.__valkiriaHooked = true;

  const DATA_EVENT = "valkiria:data";
  const HELLO_EVENT = "valkiria:hello";
  const READY_EVENT = "valkiria:ready";
  const MAX_BODY_CHARS = 20 * 1024 * 1024;
  const MAX_QUEUE = 200;

  // Only API paths that carry feed data are copied, to keep overhead low.
  // Each entry: [hostname, path pattern]. The page's own host is always first.
  const host = location.hostname;
  let routes = null;
  if (/(^|\.)instagram\.com$/.test(host)) {
    const re = /^\/(graphql\/query|api\/graphql|api\/v1\/)/;
    routes = [[host, re], ["i.instagram.com", re]];
  } else if (/(^|\.)tiktok\.com$/.test(host)) {
    routes = [[host, /^\/api\//]];
  } else if (/(^|\.)(x|twitter)\.com$/.test(host)) {
    routes = [[host, /^\/i\/api\/(graphql|2)\//], ["api.x.com", /^\/(graphql|2)\//], ["api.twitter.com", /^\/(graphql|2)\//]];
  } else if (/(^|\.)facebook\.com$/.test(host)) {
    routes = [[host, /^\/api\/graphql\/?/]];
  }
  if (!routes) return;

  let ready = false;
  const queue = [];

  // GraphQL requests on Instagram/Facebook carry the query's name in the body, e.g.
  // fb_api_req_friendly_name=PolarisProfileReelsTabContentQuery. Only that name is kept.
  function queryName(body) {
    try {
      const s = typeof body === "string" ? body : body instanceof URLSearchParams ? body.toString() : "";
      const m = /(?:^|&)fb_api_req_friendly_name=([A-Za-z0-9_]{1,80})/.exec(s);
      return m ? m[1] : null;
    } catch (_) {
      return null;
    }
  }

  function emit(url, text, name) {
    const detail = JSON.stringify({ url: url, text: text, name: name || null });
    if (!ready) {
      if (queue.length >= MAX_QUEUE) queue.shift();
      queue.push(detail);
      return;
    }
    document.dispatchEvent(new CustomEvent(DATA_EVENT, { detail: detail }));
  }

  document.addEventListener(READY_EVENT, function () {
    if (ready) return;
    ready = true;
    while (queue.length) document.dispatchEvent(new CustomEvent(DATA_EVENT, { detail: queue.shift() }));
  });
  document.dispatchEvent(new CustomEvent(HELLO_EVENT));

  function wanted(rawUrl) {
    try {
      const u = new URL(rawUrl, location.href);
      return routes.some(([h, re]) => u.hostname === h && re.test(u.pathname)) ? u.href : null;
    } catch (_) {
      return null;
    }
  }

  // fetch
  const origFetch = window.fetch;
  if (typeof origFetch === "function") {
    window.fetch = function (input, init) {
      const p = origFetch.apply(this, arguments);
      try {
        const raw = typeof input === "string" ? input : input && (input.url || String(input));
        const url = wanted(raw);
        const name = url ? queryName(init && init.body) : null;
        if (url) {
          p.then(function (res) {
            try {
              const ct = res.headers.get("content-type") || "";
              if (!res.ok || /image|video|audio|octet-stream/.test(ct)) return;
              res.clone().text().then(function (t) {
                if (t && t.length <= MAX_BODY_CHARS) emit(url, t, name);
              }, function () {});
            } catch (_) {}
          }, function () {});
        }
      } catch (_) {}
      return p;
    };
  }

  // XMLHttpRequest
  const XHR = window.XMLHttpRequest;
  if (XHR && XHR.prototype) {
    const origOpen = XHR.prototype.open;
    const origSend = XHR.prototype.send;
    XHR.prototype.open = function (method, url) {
      try {
        this.__valkiriaUrl = wanted(url);
      } catch (_) {}
      return origOpen.apply(this, arguments);
    };
    XHR.prototype.send = function (body) {
      try {
        if (this.__valkiriaUrl) {
          const xhr = this;
          const name = queryName(body);
          xhr.addEventListener("load", function () {
            try {
              if (xhr.status < 200 || xhr.status >= 300) return;
              let t = null;
              if (xhr.responseType === "" || xhr.responseType === "text") t = xhr.responseText;
              else if (xhr.responseType === "json" && xhr.response != null) t = JSON.stringify(xhr.response);
              if (t && t.length <= MAX_BODY_CHARS) emit(xhr.__valkiriaUrl, t, name);
            } catch (_) {}
          });
        }
      } catch (_) {}
      return origSend.apply(this, arguments);
    };
  }
})();
