// backend/test/api.test.mjs
//
// End-to-end API tests against the compiled server (dist/), with
// throwaway data/upload dirs and a stub formatter. Run: npm test

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 4900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_KEY = "test-admin-key";

let tmp, server, formatter, formatterUrl, previewStub;

// Stub formatter: "BAD-DOCX" in the upload -> 422, otherwise a fake DOCX
// (carrying a "NO-PREVIEW" marker through for the preview stub).
function startStubFormatter() {
  return new Promise((resolve) => {
    formatter = http.createServer((req, res) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const body = Buffer.concat(chunks).toString("latin1");
        if (body.includes("BAD-DOCX")) {
          res.writeHead(422, { "content-type": "application/json" });
          return res.end(JSON.stringify({ detail: "The uploaded file is not a valid .docx document" }));
        }
        res.writeHead(200, { "content-type": "application/octet-stream" });
        res.end(Buffer.from(body.includes("NO-PREVIEW") ? "PK-formatted-docx NO-PREVIEW" : "PK-formatted-docx"));
      });
    });
    formatter.listen(0, "127.0.0.1", () => {
      formatterUrl = `http://127.0.0.1:${formatter.address().port}`;
      resolve();
    });
  });
}

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("backend did not start");
}

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "docstudio-test-"));
  await startStubFormatter();
  // Stub preview renderer, run as PREVIEW_PYTHON <script> <in> <outDir> <max>:
  // "NO-PREVIEW" in the formatted file -> failure, otherwise two pages.
  previewStub = path.join(tmp, "preview-stub.sh");
  fs.writeFileSync(previewStub, [
    "#!/bin/sh",
    'grep -q NO-PREVIEW "$2" && { echo "render failed" >&2; exit 1; }',
    'mkdir -p "$3" && printf PNG1 > "$3/1.png" && printf PNG2 > "$3/2.png"',
    'echo \'{"pageCount": 12, "pages": [1, 7]}\'',
  ].join("\n"), { mode: 0o755 });
  server = spawn(process.execPath, [path.join(BACKEND, "dist", "index.js")], {
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR: path.join(tmp, "data"),
      UPLOAD_DIR: path.join(tmp, "uploads"),
      FORMATTER_URL: formatterUrl,
      ADMIN_KEY,
      DAILY_JOB_LIMIT: "3",
      MAX_UPLOAD_MB: "1",
      BILLING_ENABLED: "",
      PREVIEW_PYTHON: previewStub,
      GUEST_DAILY_LIMIT: "4",
    },
    stdio: "ignore",
  });
  await waitForServer();
});

after(() => {
  server?.kill();
  formatter?.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** A tiny cookie-jar client. */
function client() {
  const jar = new Map();
  return async (method, url, { json, form, headers = {} } = {}) => {
    const init = { method, headers: { ...headers } };
    if (jar.size) init.headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    if (json) {
      init.headers["content-type"] = "application/json";
      init.body = JSON.stringify(json);
    }
    if (form) init.body = form;
    const res = await fetch(BASE + url, init);
    const setCookie = res.headers.get("set-cookie");
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const [name, value] = [pair.slice(0, i), pair.slice(i + 1)];
      if (!value || /Expires=Thu, 01 Jan 1970/i.test(c)) jar.delete(name);
      else jar.set(name, value);
    }
    const type = res.headers.get("content-type") || "";
    const body = type.includes("json") ? await res.json() : await res.arrayBuffer();
    return { status: res.status, body, setCookie };
  };
}

let seq = 0;
async function registered() {
  const api = client();
  const n = `${Date.now()}${seq++}`;
  const res = await api("POST", "/auth/register", {
    json: { fullName: "Test User", email: `u${n}@test.local`, phone: `6${n.slice(-8)}`, password: "secret123" },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { api, user: res.body, email: `u${n}@test.local` };
}

function docxForm(name = "My Thesis.docx", content = "PK-original", documentType = "report") {
  const form = new FormData();
  form.append("file", new Blob([content]), name);
  form.append("profileId", "ub-v1");
  form.append("documentType", documentType);
  return form;
}

test("register sets an HttpOnly session cookie and never returns secrets", async () => {
  const { api, user } = await registered();
  assert.equal(user.passwordHash, undefined);
  assert.equal(user.freeRemaining, undefined);
  const me = await api("GET", "/auth/me");
  assert.equal(me.status, 200);
  assert.equal(me.body.id, user.id);
});

test("session cookie flags", async () => {
  const api = client();
  const n = `${Date.now()}c`;
  const res = await api("POST", "/auth/register", {
    json: { fullName: "C", email: `c${n}@test.local`, phone: `7${n.slice(-8)}`, password: "secret123" },
  });
  assert.match(res.setCookie, /ds_session=/);
  assert.match(res.setCookie, /HttpOnly/i);
  assert.match(res.setCookie, /SameSite=Lax/i);
});

test("the old x-user-id header no longer authenticates", async () => {
  const { user } = await registered();
  const anon = client();
  for (const url of ["/auth/me", "/documents"]) {
    const res = await anon("GET", url, { headers: { "x-user-id": user.id } });
    assert.equal(res.status, 401, url);
  }
});

test("login, logout, and wrong password", async () => {
  const { email } = await registered();
  const api = client();
  assert.equal((await api("POST", "/auth/login", { json: { identifier: email, password: "nope" } })).status, 401);
  assert.equal((await api("POST", "/auth/login", { json: { identifier: email, password: "secret123" } })).status, 200);
  assert.equal((await api("GET", "/auth/me")).status, 200);
  assert.equal((await api("POST", "/auth/logout")).status, 204);
  assert.equal((await api("GET", "/auth/me")).status, 401);
});

test("registration validation", async () => {
  const api = client();
  const bad = await api("POST", "/auth/register", {
    json: { fullName: "X", email: "not-an-email", phone: "600000001", password: "secret123" },
  });
  assert.equal(bad.status, 400);
  const short = await api("POST", "/auth/register", {
    json: { fullName: "X", email: "x@test.local", phone: "600000002", password: "123" },
  });
  assert.equal(short.status, 400);
});

test("failed logins are throttled", async () => {
  const { email } = await registered();
  const api = client();
  let last;
  for (let i = 0; i < 11; i++) {
    last = await api("POST", "/auth/login", { json: { identifier: email, password: "wrong" } });
  }
  assert.equal(last.status, 429);
});

test("documents are free with billing off, and downloads use the original name", async () => {
  const { api } = await registered();
  for (const type of ["phd", "report", "print_ready"]) {
    const res = await api("POST", "/documents", { form: docxForm("My Thesis.docx", "PK", type) });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.job.isFree, true);
    assert.equal(res.body.job.priceCfa, 0);
    assert.equal(res.body.job.inputPath, undefined);   // no server paths leaked
    assert.equal(res.body.job.originalName, "My Thesis.docx");
  }
  const list = await api("GET", "/documents");
  assert.equal(list.body.length, 3);
  const anonymous = await fetch(`${BASE}/documents/${list.body[0].id}/download`);
  assert.equal(anonymous.status, 401);                 // needs the session
});

test("download works for the owner only", async () => {
  const owner = await registered();
  const created = await owner.api("POST", "/documents", { form: docxForm("Report One.docx") });
  const id = created.body.job.id;
  const dl = await owner.api("GET", `/documents/${id}/download`);
  assert.equal(dl.status, 200);
  assert.equal(Buffer.from(dl.body).toString(), "PK-formatted-docx");
  const other = await registered();
  assert.equal((await other.api("GET", `/documents/${id}/download`)).status, 404);
  assert.equal((await other.api("GET", `/documents/${id}`)).status, 404);
});

test("daily document limit", async () => {
  const { api } = await registered();
  for (let i = 0; i < 3; i++) {
    assert.equal((await api("POST", "/documents", { form: docxForm() })).status, 201);
  }
  const res = await api("POST", "/documents", { form: docxForm() });
  assert.equal(res.status, 429);
  assert.match(res.body.error, /per day/);
});

test("upload checks: .docx only, size limit, formatter 422 passthrough", async () => {
  const { api } = await registered();
  const pdf = await api("POST", "/documents", { form: docxForm("paper.pdf") });
  assert.equal(pdf.status, 400);
  const big = await api("POST", "/documents", { form: docxForm("big.docx", "x".repeat(1.5 * 1024 * 1024)) });
  assert.equal(big.status, 413);
  const bad = await api("POST", "/documents", { form: docxForm("bad.docx", "BAD-DOCX") });
  assert.equal(bad.status, 422);
  assert.match(bad.body.error, /not a valid \.docx/);
});

test("feedback: per document and general, validated", async () => {
  const { api } = await registered();
  const job = (await api("POST", "/documents", { form: docxForm("Feedback Doc.docx") })).body.job;
  assert.equal((await api("POST", "/feedback", { json: { jobId: job.id, rating: 4, comment: "Nice" } })).status, 201);
  assert.equal((await api("POST", "/feedback", { json: { comment: "General idea" } })).status, 201);
  assert.equal((await api("POST", "/feedback", { json: { rating: 9 } })).status, 400);
  assert.equal((await api("POST", "/feedback", { json: {} })).status, 400);
  const other = await registered();
  assert.equal((await other.api("POST", "/feedback", { json: { jobId: job.id, rating: 1 } })).status, 404);
  assert.equal((await client()("POST", "/feedback", { json: { comment: "anon" } })).status, 401);
});

test("admin overview requires the admin key and hides secrets", async () => {
  const api = client();
  assert.equal((await api("GET", "/admin/overview")).status, 401);
  assert.equal((await api("GET", "/admin/overview", { headers: { "x-admin-key": "wrong" } })).status, 401);
  const res = await api("GET", "/admin/overview", { headers: { "x-admin-key": ADMIN_KEY } });
  assert.equal(res.status, 200);
  assert.ok(res.body.totals.users >= 1);
  assert.ok(res.body.feedback.some((f) => f.comment === "Nice" && f.rating === 4 && f.job?.originalName === "Feedback Doc.docx"));
  assert.ok(res.body.recentFailures.some((f) => f.originalName === "bad.docx"));
  assert.ok(!JSON.stringify(res.body).includes("passwordHash"));
});

test("centers: creating one never returns the password hash", async () => {
  const { api } = await registered();
  const res = await api("POST", "/centers", { json: { name: "Buea Print Centre" } });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.passwordHash, undefined);
  assert.equal((await api("GET", "/centers/me")).status, 200);
});

test("a visitor can try without an account, see previews, and claim on register", async () => {
  const guest = client();
  const res = await guest("POST", "/try", { form: docxForm("Trial Thesis.docx", "PK", "undergraduate") });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.match(res.setCookie, /ds_guest=.*HttpOnly/i);
  const job = res.body.job;
  assert.equal(job.status, "done");
  assert.deepEqual(job.previewPages, [1, 7]);
  assert.equal(job.pageCount, 12);
  assert.equal(job.guestId, undefined);

  // Previews for this browser only; no download without an account.
  const img = await guest("GET", `/try/${job.id}/preview/2`);
  assert.equal(img.status, 200);
  assert.equal(Buffer.from(img.body).toString(), "PNG2");
  assert.equal((await guest("GET", `/try/${job.id}/preview/3`)).status, 404);
  assert.equal((await client()("GET", `/try/${job.id}`)).status, 404);
  assert.equal((await client()("GET", `/try/${job.id}/preview/1`)).status, 404);
  assert.equal((await guest("GET", `/documents/${job.id}/download`)).status, 401);

  const n = `${Date.now()}g`;
  const reg = await guest("POST", "/auth/register", {
    json: { fullName: "Guest", email: `g${n}@test.local`, phone: `5${n.slice(-8)}`, password: "secret123" },
  });
  assert.equal(reg.status, 201);
  assert.deepEqual(reg.body.claimedJobIds, [job.id]);

  const dl = await guest("GET", `/documents/${job.id}/download`);
  assert.equal(dl.status, 200);
  assert.equal(Buffer.from(dl.body).toString(), "PK-formatted-docx");
  assert.equal((await guest("GET", `/documents/${job.id}/preview/1`)).status, 200);
  assert.equal((await guest("GET", `/try/${job.id}`)).status, 404);   // no longer a guest job
  assert.equal((await guest("GET", "/documents")).body.length, 1);
});

test("an existing user claims their trial by logging in", async () => {
  const { email } = await registered();
  const guest = client();
  const job = (await guest("POST", "/try", { form: docxForm("Trial Report.docx") })).body.job;
  const login = await guest("POST", "/auth/login", { json: { identifier: email, password: "secret123" } });
  assert.equal(login.status, 200);
  assert.deepEqual(login.body.claimedJobIds, [job.id]);
  assert.equal((await guest("GET", `/documents/${job.id}`)).body.originalName, "Trial Report.docx");
});

test("a failed preview still delivers the formatted document", async () => {
  const guest = client();
  const res = await guest("POST", "/try", { form: docxForm("np.docx", "PK NO-PREVIEW") });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(res.body.job.previewPages, []);
});

test("trials are limited per visitor per day", async () => {
  // Earlier tests used 3 of the 4 tries allowed from 127.0.0.1.
  const guest = client();
  assert.equal((await guest("POST", "/try", { form: docxForm() })).status, 201);
  const res = await guest("POST", "/try", { form: docxForm() });
  assert.equal(res.status, 429);
  assert.match(res.body.error, /free 4 tries/);
});
