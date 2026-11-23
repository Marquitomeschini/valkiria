// Runs the Mac installer and updater for real (bash), with a local server standing in for GitHub
// and stubs for the macOS-only commands (launchctl, pbcopy, open) that record how they were called.
// Run with: node --test test/mac-installer.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync, readdirSync, cpSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const T = mkdtempSync(path.join(os.tmpdir(), "valkiria-mac-"));
const HOME = path.join(T, "home");
const SERVE = path.join(T, "github");
const STUBS = path.join(T, "stubs");
const LOGS = path.join(T, "logs");
let server;
let port;

const sh = (args, env, input) =>
  execFileSync("bash", args, { env: { PATH: `${STUBS}:${process.env.PATH}`, HOME, TMPDIR: path.join(T, "tmp"), ...env }, encoding: "utf8", input });
const version = () => JSON.parse(readFileSync(path.join(root, "extension/manifest.json"), "utf8")).version;

// A GitHub-like "archive" zip of the project (top folder valkiria-main/), keeping exec bits.
function buildZip(out, manifestVersion) {
  const stage = mkdtempSync(path.join(T, "stage-"));
  const top = path.join(stage, "valkiria-main");
  mkdirSync(top);
  cpSync(path.join(root, "extension"), path.join(top, "extension"), { recursive: true });
  cpSync(path.join(root, "tools"), path.join(top, "tools"), { recursive: true });
  if (manifestVersion) {
    const mf = path.join(top, "extension/manifest.json");
    const m = JSON.parse(readFileSync(mf, "utf8"));
    m.version = manifestVersion;
    writeFileSync(mf, JSON.stringify(m, null, 2));
  }
  execFileSync("python3", ["-I", "-c", `
import os, sys, zipfile
stage, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for d, _, files in os.walk(stage):
        for f in files:
            p = os.path.join(d, f)
            info = zipfile.ZipInfo(os.path.relpath(p, stage))
            info.create_system = 3
            info.external_attr = (os.stat(p).st_mode & 0xFFFF) << 16
            z.writestr(info, open(p, "rb").read())
`, stage, out]);
}

before(async () => {
  for (const d of [HOME, SERVE, STUBS, LOGS, path.join(T, "tmp")]) mkdirSync(d, { recursive: true });
  for (const cmd of ["launchctl", "pbcopy", "open"]) {
    // pbcopy keeps what it was given; the others record their arguments.
    const body = cmd === "pbcopy" ? `cat > "${LOGS}/pbcopy"` : `echo "$@" >> "${LOGS}/${cmd}"`;
    writeFileSync(path.join(STUBS, cmd), `#!/bin/bash\n${body}\nexit 0\n`, { mode: 0o755 });
  }
  buildZip(path.join(SERVE, "main.zip"));
  mkdirSync(path.join(SERVE, "new"));
  buildZip(path.join(SERVE, "new", "main.zip"), "9.9.9");
  writeFileSync(path.join(SERVE, "manifest.json"), readFileSync(path.join(root, "extension/manifest.json")));
  writeFileSync(path.join(SERVE, "new", "manifest.json"), JSON.stringify({ name: "Valkiria", version: "9.9.9" }));
  port = 20000 + Math.floor(Math.random() * 20000);
  server = spawn("python3", ["-I", "-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", SERVE], { stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try {
      execFileSync("curl", ["-fsS", "-o", "/dev/null", `http://127.0.0.1:${port}/manifest.json`]);
      return;
    } catch (_) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error("local server did not start");
});
after(() => server && server.kill());

const URL_ = (p) => `http://127.0.0.1:${port}/${p}`;
const BASE = () => path.join(HOME, "Valkiria");
const isExec = (f) => (statSync(f).mode & 0o111) !== 0;

test("installer: downloads, installs, schedules updates, copies the path and opens the browser", () => {
  const out = sh([path.join(root, "instalar-valkiria-mac.command")], { VALKIRIA_ZIP_URL: URL_("main.zip") });
  assert.match(out, new RegExp(`Valkiria ${version().replace(/\./g, "\\.")} quedo en ${BASE()}/extension`));
  assert.match(out, /FALTA UN SOLO PASO, EN BRAVE/);
  assert.ok(existsSync(path.join(BASE(), "extension/manifest.json")));
  assert.ok(isExec(path.join(BASE(), "actualizador/actualizar.sh")));
  for (const f of ["Actualizar ahora.command", "Desactivar actualizaciones.command"]) assert.ok(isExec(path.join(BASE(), f)), f);
  // The LaunchAgent: valid plist, runs the updater every 15 minutes and at login.
  const plist = path.join(HOME, "Library/LaunchAgents/com.valkiria.actualizar.plist");
  const parsed = JSON.parse(execFileSync("python3", ["-I", "-c", "import json,plistlib,sys; print(json.dumps(plistlib.load(open(sys.argv[1],'rb'))))", plist], { encoding: "utf8" }));
  assert.deepEqual(parsed.ProgramArguments, ["/bin/bash", path.join(BASE(), "actualizador/actualizar.sh")]);
  assert.equal(parsed.StartInterval, 900);
  assert.equal(parsed.RunAtLoad, true);
  const uid = execFileSync("id", ["-u"], { encoding: "utf8" }).trim();
  assert.match(readFileSync(path.join(LOGS, "launchctl"), "utf8"), new RegExp(`bootstrap gui/${uid} ${plist.replace(/[.]/g, "\\.")}`));
  assert.equal(readFileSync(path.join(LOGS, "pbcopy"), "utf8"), path.join(BASE(), "extension"), "path copied for Cmd+Shift+G");
  assert.ok(!existsSync(path.join(LOGS, "open")), "no browser in /Applications here: nothing to open");
  assert.deepEqual(readdirSync(path.join(T, "tmp")), [], "temporary files cleaned up");
});

test("installer also works pasted in the Terminal (curl ... | bash)", () => {
  const script = readFileSync(path.join(root, "instalar-valkiria-mac.command"), "utf8");
  const out = sh([], { VALKIRIA_ZIP_URL: URL_("main.zip") }, script);
  assert.match(out, /quedo en/);
});

test("updater: up to date, then a new version replaces the files, errors keep the install", () => {
  const upd = path.join(BASE(), "actualizador/actualizar.sh");
  const log = path.join(BASE(), "actualizador/ultimo-resultado.txt");
  assert.match(sh([upd], { VALKIRIA_MANIFEST_URL: URL_("manifest.json"), VALKIRIA_ZIP_URL: URL_("main.zip") }), /Al dia: version/);
  assert.match(readFileSync(log, "utf8"), /Al dia/);

  // Offline: nothing changes.
  assert.throws(() => sh([upd], { VALKIRIA_MANIFEST_URL: "http://127.0.0.1:1/manifest.json" }));
  assert.match(readFileSync(log, "utf8"), /no se pudo leer la version/);
  assert.equal(JSON.parse(readFileSync(path.join(BASE(), "extension/manifest.json"), "utf8")).version, version());

  const out = sh([upd], { VALKIRIA_MANIFEST_URL: URL_("new/manifest.json"), VALKIRIA_ZIP_URL: URL_("new/main.zip") });
  assert.match(out, new RegExp(`Actualizada de ${version().replace(/\./g, "\\.")} a 9\\.9\\.9`));
  assert.equal(JSON.parse(readFileSync(path.join(BASE(), "extension/manifest.json"), "utf8")).version, "9.9.9");
  assert.ok(isExec(upd), "the updater replaced itself and is still executable");
  assert.match(readFileSync(log, "utf8"), /Actualizada/);
  assert.ok(!readdirSync(BASE()).some((f) => f.endsWith(".nuevo")), "no leftovers");
});

test("folder shortcuts: update now, and turn automatic updates off", () => {
  assert.match(sh([path.join(BASE(), "Actualizar ahora.command")], { VALKIRIA_MANIFEST_URL: URL_("new/manifest.json") }), /Al dia: version 9\.9\.9/);
  const plist = path.join(HOME, "Library/LaunchAgents/com.valkiria.actualizar.plist");
  assert.ok(existsSync(plist));
  assert.match(sh([path.join(BASE(), "Desactivar actualizaciones.command")]), /ya no se actualiza sola/);
  assert.ok(!existsSync(plist));
  assert.match(readFileSync(path.join(LOGS, "launchctl"), "utf8"), /bootout gui\/\d+\/com\.valkiria\.actualizar/);
});
