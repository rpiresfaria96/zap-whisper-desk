import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

test("session controls use original WPP routes and native webhook without exposing tokens", async () => {
  const calls = [];
  const wpp = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    calls.push({ path: req.url, auth: req.headers.authorization,
      body: body ? JSON.parse(body) : null });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(req.url.endsWith("/status-session") ?
      { status: "CLOSED" } : { status: true }));
  });
  await listen(wpp);
  const apiProbe = createServer();
  await listen(apiProbe);
  const port = apiProbe.address().port;
  await new Promise((resolve) => apiProbe.close(resolve));
  const child = spawn(process.execPath, [fileURLToPath(new URL("./server.mjs", import.meta.url))], {
    env: { ...process.env, API_PORT: String(port), WPP_SESSION: "test", WPP_TOKEN: "test-only",
      WPP_BASE_URL: `http://127.0.0.1:${wpp.address().port}`,
      WPP_QR_BRIDGE_SECRET: "c".repeat(64) },
    stdio: "ignore",
  });
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 40; i++) {
      try { if ((await fetch(base + "/health")).ok) break; }
      catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    const send = (path, data = {}) => fetch(base + path, { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    let response = await send("/connection/close");
    assert.equal(response.status, 200);
    assert(calls.some((x) => x.path === "/api/test/close-session"));

    response = await send("/connection/relink");
    assert.equal(response.status, 400);
    assert(!calls.some((x) => x.path === "/api/test/logout-session"));

    response = await send("/connection/relink", { confirmation: "DESVINCULAR" });
    assert.equal(response.status, 200);
    assert(calls.some((x) => x.path === "/api/test/logout-session"));

    response = await send("/connection/start");
    assert.equal(response.status, 202);
    for (let i = 0; i < 40 && !calls.some((x) => x.path === "/api/test/start-session"); i++)
      await new Promise((r) => setTimeout(r, 50));
    const start = calls.find((x) => x.path === "/api/test/start-session");
    assert(start, "native start-session should have been invoked");
    assert.deepEqual(start.body, {
      waitQrCode: false,
      webhook: "http://127.0.0.1:" + port + "/internal/wpp-hook?key=" + "c".repeat(64),
    });
    assert(calls.every((x) => x.auth === "Bearer test-only"));
  } finally {
    if (child.exitCode === null) { child.kill(); await once(child, "exit"); }
    await new Promise((r) => wpp.close(r));
  }
});
