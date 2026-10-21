import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, symlink, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { prepareFiles, writeFiles } from "../../src/generate/generate-files.js";
import { CLI_NODE_BINARY } from "../helpers/project-fixture.js";

function deferred() {
  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

test("generated authentication with real Axios", {
  skip: process.env.AXIOS_TEST_DIRECTORY ? false : "Run npm run test:auth with a prepared AXIOS_TEST_DIRECTORY; no registry access in routine tests.",
}, async (t) => {
  const fixture = resolve(process.env.AXIOS_TEST_DIRECTORY);
  const require = createRequire(join(fixture, "package.json"));
  const axios = require("axios");
  t.diagnostic(`Axios ${axios.VERSION}; contributor runner ${process.version}`);
  const directory = await mkdtemp(join(tmpdir(), "axios-scaffold-auth-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, "package.json"), '{"type":"module"}');
  await symlink(join(fixture, "node_modules"), join(directory, "node_modules"), "junction");
  await writeFiles(await prepareFiles(directory));
  const { attachAuthInterceptors } = await import(pathToFileURL(join(directory, "src/api/auth/attachAuthInterceptors.js")));
  const { apiClient, cleanupAuth } = await import(pathToFileURL(join(directory, "src/api/apiClient.js")));
  const { exampleApi } = await import(pathToFileURL(join(directory, "src/api/exampleApi.js")));

  function clientWithAdapter(handler) {
    return axios.create({
      baseURL: "https://api.example.com/v1",
      adapter: async (config) => {
        const result = await handler(config);
        const response = { config, status: result?.status ?? 200, statusText: "fixture", headers: {}, data: result?.data ?? {} };
        if (!config.validateStatus || config.validateStatus(response.status)) return response;
        throw new axios.AxiosError("Fixture HTTP failure", "ERR_BAD_RESPONSE", config, {}, response);
      },
    });
  }

  await t.test("unconfigured and empty-config clients preserve full responses", async () => {
    assert.equal(apiClient.interceptors.request.handlers.filter(Boolean).length, 0);
    assert.equal(apiClient.interceptors.response.handlers.filter(Boolean).length, 0);
    cleanupAuth(); cleanupAuth();
    apiClient.defaults.adapter = async (config) => ({ config, status: 200, headers: {}, data: { ok: true } });
    assert.equal((await apiClient.get("/public")).status, 200);
    assert.deepEqual(await exampleApi.getAll(), { ok: true });
    const client = clientWithAdapter((config) => {
      assert.equal(config.headers.get("Authorization"), undefined);
    });
    const cleanup = attachAuthInterceptors(client);
    await client.get("/public");
    cleanup();
    cleanup();
  });

  await t.test("default generated imports do not read browser globals or start requests", async () => {
    const script = `
      import assert from "node:assert/strict";
      import axios from "axios";
      // Axios itself is loaded first; the assertions below concern our generated modules.
      axios.defaults.adapter = () => { throw new Error("Unexpected request during import"); };
      for (const name of ["window", "sessionStorage", "localStorage"]) {
        Object.defineProperty(globalThis, name, { get() { throw new Error("Unexpected browser access: " + name); } });
      }
      const { apiClient, cleanupAuth } = await import("./src/api/apiClient.js");
      const { createAuthConfig } = await import("./src/api/auth/authConfig.js");
      assert.deepEqual(createAuthConfig(new Proxy({}, { get() { throw new Error("Unexpected client access"); } })), {});
      assert.equal(apiClient.interceptors.request.handlers.filter(Boolean).length, 0);
      assert.equal(apiClient.interceptors.response.handlers.filter(Boolean).length, 0);
      cleanupAuth(); cleanupAuth();
    `;
    await writeFile(join(directory, "default-import-fixture.mjs"), script);
    const result = spawnSync(CLI_NODE_BINARY, [join(directory, "default-import-fixture.mjs")], { encoding: "utf8", timeout: 15000 });
    assert.equal(result.status, 0, result.stderr);
  });

  for (const recipe of ["bearer", "refresh", "csrf"]) {
    await t.test(`the documented ${recipe} configuration works through automatic client wiring`, async () => {
      const guide = await readFile(new URL("../../docs/AUTHENTICATION.md", import.meta.url), "utf8");
      // Exercise both checkout formats on every operating system.
      const sources = [guide.replace(/\r\n/g, "\n"), guide.replace(/\r?\n/g, "\r\n")]
        .map((text) => text.split(`<!-- recipe:${recipe} -->`)[1]?.match(/```js\r?\n([\s\S]*?)```/)?.[1]);
      for (const source of sources) assert.ok(source, `Missing copyable ${recipe} recipe`);
      assert.equal(sources[0], sources[1].replace(/\r\n/g, "\n"));
      const source = sources[1];
      const root = await mkdtemp(join(tmpdir(), "axios-scaffold-recipe-"));
      t.after(() => rm(root, { recursive: true, force: true }));
      await writeFile(join(root, "package.json"), '{"type":"module"}');
      await symlink(join(fixture, "node_modules"), join(root, "node_modules"), "junction");
      await writeFiles(await prepareFiles(root));
      await writeFile(join(root, "src/api/auth/authConfig.js"), source);
      const script = `
        import assert from "node:assert/strict";
        import axios from "axios";
        const recipe = ${JSON.stringify(recipe)};
        const values = new Map([["accessToken", "old"], ["csrfToken", "csrf"]]);
        globalThis.sessionStorage = {
          getItem: key => values.get(key) ?? null,
          setItem: (key, value) => values.set(key, value),
          removeItem: key => values.delete(key),
        };
        let refreshes = 0;
        let failRefresh = false;
        axios.defaults.adapter = async config => {
          let status = 200;
          let data = {};
          if (config.url === "/your-refresh-endpoint") {
            refreshes++;
            status = failRefresh ? 500 : 200;
            data = { accessToken: "new" };
          } else if (recipe === "refresh" && config.url === "/private" && config.headers.get("Authorization") !== "Bearer new") {
            status = 401;
          }
          const response = { config, status, headers: {}, data };
          if (status >= 400) throw new axios.AxiosError("fixture", "ERR_BAD_RESPONSE", config, {}, response);
          return response;
        };
        const { apiClient, cleanupAuth } = await import("./src/api/apiClient.js");
        const { attachAuthInterceptors } = await import("./src/api/auth/attachAuthInterceptors.js");
        assert.equal(apiClient.interceptors.request.handlers.filter(Boolean).length, 1);
        assert.throws(() => attachAuthInterceptors(apiClient, { getAccessToken: () => "duplicate" }), /already configured/);
        const response = await apiClient.post("/private", {});
        if (recipe === "csrf") {
          assert.equal(response.config.headers.get("Authorization"), undefined);
          assert.equal(response.config.headers.get("X-XSRF-TOKEN"), "csrf");
          assert.equal((await apiClient.post("/plain", {}, { skipCsrf: true })).config.headers.get("X-XSRF-TOKEN"), undefined);
        } else {
          assert.equal(response.config.headers.get("Authorization"), recipe === "refresh" ? "Bearer new" : "Bearer old");
          assert.equal((await apiClient.get("/public", { skipAuth: true })).config.headers.get("Authorization"), undefined);
        }
        assert.equal(refreshes, recipe === "refresh" ? 1 : 0);
        if (recipe === "refresh") {
          assert.equal(sessionStorage.getItem("accessToken"), "new");
          sessionStorage.setItem("accessToken", "old");
          failRefresh = true;
          await assert.rejects(apiClient.get("/private"));
          assert.equal(sessionStorage.getItem("accessToken"), null);
        }
        cleanupAuth(); cleanupAuth();
        const after = await apiClient.post("/after-cleanup", {});
        assert.equal(after.config.headers.get("Authorization"), undefined);
        assert.equal(after.config.headers.get("X-XSRF-TOKEN"), undefined);
        const cleanupManual = attachAuthInterceptors(apiClient, { getAccessToken: () => "manual" });
        assert.equal((await apiClient.get("/manual")).config.headers.get("Authorization"), "Bearer manual");
        cleanupManual();
      `;
      await writeFile(join(root, "recipe-fixture.mjs"), script);
      const result = spawnSync(CLI_NODE_BINARY, [join(root, "recipe-fixture.mjs")], { encoding: "utf8", timeout: 15000 });
      assert.equal(result.status, 0, result.stderr);
    });
  }

  await t.test("validates options and origin before adding interceptors", () => {
    for (const options of [null, [], { getAccessToken: "bad" }, { refreshAccessToken() {} }, { csrf: {} }, { csrf: { getToken() {}, headerName: "bad\nheader" } }]) {
      const client = clientWithAdapter(() => ({}));
      assert.throws(() => attachAuthInterceptors(client, options));
      assert.equal(client.interceptors.request.handlers.length, 0);
    }
    assert.throws(() => attachAuthInterceptors(axios.create(), { getAccessToken: () => "token" }), /baseURL/);
    assert.throws(() => attachAuthInterceptors(axios.create({ baseURL: "file:///tmp/api" }), { getAccessToken: () => "token" }), /baseURL/);
  });

  await t.test("attaches async tokens, preserves explicit headers, and supports public bypass", async () => {
    let lookups = 0;
    const seen = [];
    const client = clientWithAdapter((config) => { seen.push(config.headers.get("Authorization")); });
    const cleanup = attachAuthInterceptors(client, { getAccessToken: async () => { lookups++; return "access"; } });
    await client.get("/private");
    await client.get("/public", { skipAuth: true });
    await client.get("/custom", { headers: { authorization: "Custom value" } });
    await client.get("/basic", { auth: { username: "name", password: "password" } });
    assert.deepEqual(seen, ["Bearer access", undefined, "Custom value", undefined]);
    assert.equal(lookups, 1);
    assert.throws(() => attachAuthInterceptors(client, { getAccessToken: () => "other" }), /already configured/);
    const other = client.interceptors.request.use((config) => { config.headers.set("X-Other", "kept"); return config; });
    cleanup(); cleanup();
    assert.equal((await client.get("/after-cleanup")).config.headers.get("X-Other"), "kept");
    const again = attachAuthInterceptors(client, { getAccessToken: () => "new" });
    assert.equal((await client.get("/reconfigured")).config.headers.get("Authorization"), "Bearer new");
    again(); client.interceptors.request.eject(other);
  });

  await t.test("missing tokens pass through and token-hook errors reject before dispatch", async () => {
    let calls = 0;
    const client = clientWithAdapter(() => { calls++; });
    let token = null;
    const cleanup = attachAuthInterceptors(client, { getAccessToken: () => token });
    await client.get("/public");
    token = 123;
    await assert.rejects(client.get("/invalid"), /token string/);
    assert.equal(calls, 1);
    cleanup();
    const failure = new Error("token lookup failed");
    attachAuthInterceptors(client, { getAccessToken: async () => { throw failure; } });
    await assert.rejects(client.get("/error"), (error) => error === failure);
    assert.equal(calls, 1);
  });

  await t.test("ordinary config replays update owned headers and remove them on public or foreign requests", async () => {
    let token = "old";
    let csrfToken = "old-csrf";
    const client = clientWithAdapter(() => ({}));
    attachAuthInterceptors(client, { getAccessToken: () => token, csrf: { getToken: () => csrfToken } });
    const first = await client.post("/first", {});
    token = "new"; csrfToken = "new-csrf";
    const second = await client({ ...first.config, url: "/second" });
    assert.equal(second.config.headers.get("Authorization"), "Bearer new");
    assert.equal(second.config.headers.get("X-XSRF-TOKEN"), "new-csrf");
    const foreign = await client({ ...first.config, url: "https://foreign.example/private" });
    assert.equal(foreign.config.headers.get("Authorization"), undefined);
    assert.equal(foreign.config.headers.get("X-XSRF-TOKEN"), undefined);
    const publicRequest = await client({ ...first.config, skipAuth: true, skipCsrf: true });
    assert.equal(publicRequest.config.headers.get("Authorization"), undefined);
    assert.equal(publicRequest.config.headers.get("X-XSRF-TOKEN"), undefined);
    const caller = await client({ ...first.config, headers: { Authorization: "Caller", "X-XSRF-TOKEN": "caller-csrf" } });
    assert.equal(caller.config.headers.get("Authorization"), "Caller");
    assert.equal(caller.config.headers.get("X-XSRF-TOKEN"), "caller-csrf");
  });

  await t.test("scopes both hooks to the fixed origin including per-request baseURL overrides", async () => {
    let lookups = 0;
    const client = clientWithAdapter((config) => {
      assert.equal(config.headers.get("Authorization"), undefined);
      assert.equal(config.headers.get("X-XSRF-TOKEN"), undefined);
      return { status: 401 };
    });
    attachAuthInterceptors(client, {
      getAccessToken: () => { lookups++; return "access"; },
      refreshAccessToken: () => { throw new Error("must not refresh"); },
      csrf: { getToken: () => { lookups++; return "csrf"; } },
    });
    for (const config of [{ url: "https://other.example/private" }, { url: "/private", baseURL: "https://other.example" }, { url: "//other.example/private" }]) {
      await assert.rejects(client.request({ method: "post", ...config }), /Fixture HTTP failure/);
    }
    assert.equal(lookups, 0);
  });

  await t.test("CSRF works independently and combines with bearer auth without coupling skip flags", async () => {
    let lookups = 0;
    const client = clientWithAdapter(() => ({}));
    let cleanup = attachAuthInterceptors(client, { csrf: { getToken: async () => { lookups++; return "csrf"; }, headerName: "X-CSRF" } });
    assert.equal((await client.post("/login", {}, { skipAuth: true })).config.headers.get("X-CSRF"), "csrf");
    for (const method of ["put", "patch", "delete"]) {
      assert.equal((await client.request({ url: "/change", method })).config.headers.get("X-CSRF"), "csrf");
    }
    await client.get("/read");
    await client.post("/bypass", {}, { skipCsrf: true });
    assert.equal((await client.post("/custom", {}, { headers: { "x-csrf": "explicit" } })).config.headers.get("X-CSRF"), "explicit");
    assert.equal(lookups, 4);
    cleanup();
    cleanup = attachAuthInterceptors(client, { getAccessToken: () => "access", csrf: { getToken: () => "csrf" } });
    const both = await client.post("/both", {});
    assert.equal(both.config.headers.get("Authorization"), "Bearer access");
    assert.equal(both.config.headers.get("X-XSRF-TOKEN"), "csrf");
    const onlyCsrf = await client.post("/public", {}, { skipAuth: true });
    assert.equal(onlyCsrf.config.headers.get("Authorization"), undefined);
    assert.equal(onlyCsrf.config.headers.get("X-XSRF-TOKEN"), "csrf");
    const onlyAuth = await client.post("/private", {}, { skipCsrf: true });
    assert.equal(onlyAuth.config.headers.get("Authorization"), "Bearer access");
    assert.equal(onlyAuth.config.headers.get("X-XSRF-TOKEN"), undefined);
    cleanup();
    attachAuthInterceptors(client, { csrf: { getToken: () => { throw new Error("csrf failure"); } } });
    await assert.rejects(client.post("/change", {}), /csrf failure/);
  });

  await t.test("concurrent and delayed 401s share a refresh and later requests use persisted tokens", async () => {
    let token = "old";
    let refreshes = 0;
    let notifications = 0;
    const gate = deferred();
    const started = deferred();
    const allOld = deferred();
    const delayed = deferred();
    const delayedStarted = deferred();
    let oldCalls = 0;
    const client = clientWithAdapter(async (config) => {
      if (config.headers.get("Authorization") === "Bearer old") {
        if (config.url === "/delayed") { delayedStarted.resolve(); await delayed.promise; }
        else if (++oldCalls === 2) allOld.resolve();
        return { status: 401 };
      }
      assert.equal(config.headers.get("Authorization"), "Bearer new");
      return { data: "ok" };
    });
    attachAuthInterceptors(client, {
      getAccessToken: () => token,
      refreshAccessToken: async () => { refreshes++; started.resolve(); await gate.promise; token = "new"; return token; },
      onRefreshFailure: () => { notifications++; },
    });
    const late = client.get("/delayed");
    await delayedStarted.promise;
    const requests = [client.get("/one"), client.get("/two")];
    await allOld.promise; await started.promise;
    gate.resolve();
    assert.deepEqual((await Promise.all(requests)).map((response) => response.data), ["ok", "ok"]);
    delayed.resolve();
    assert.equal((await late).data, "ok");
    await client.get("/later");
    assert.equal(refreshes, 1);
    assert.equal(notifications, 0);
  });

  await t.test("only retries once and never refreshes public, caller-auth, 403 or network failures", async () => {
    let token = "old";
    let refreshes = 0;
    let calls = 0;
    const client = clientWithAdapter((config) => {
      calls++;
      if (config.url === "/network") throw new axios.AxiosError("network", "ERR_NETWORK", config);
      return { status: config.url === "/forbidden" ? 403 : 401 };
    });
    attachAuthInterceptors(client, { getAccessToken: () => token, refreshAccessToken: async () => { refreshes++; token = "new"; return token; } });
    await assert.rejects(client.get("/retry"));
    assert.equal(refreshes, 1); assert.equal(calls, 2);
    await assert.rejects(client.get("/public", { skipAuth: true }));
    await assert.rejects(client.get("/custom", { headers: { Authorization: "Caller" } }));
    await assert.rejects(client.get("/forbidden"));
    await assert.rejects(client.get("/network"));
    assert.equal(refreshes, 1); assert.equal(calls, 6);
  });

  await t.test("an older generation waits for a newer refresh already in progress", async () => {
    let token = "zero";
    let refreshes = 0;
    const oldest = deferred();
    const oldestSent = deferred();
    const secondRefresh = deferred();
    const secondStarted = deferred();
    let oldestRetried = false;
    const client = clientWithAdapter(async (config) => {
      const header = config.headers.get("Authorization");
      if (config.url === "/oldest" && header === "Bearer zero") {
        oldestSent.resolve(); await oldest.promise; return { status: 401 };
      }
      if (config.url === "/oldest") { oldestRetried = true; assert.equal(header, "Bearer two"); }
      return { status: header === "Bearer zero" || (config.url === "/second" && header === "Bearer one") ? 401 : 200 };
    });
    attachAuthInterceptors(client, {
      getAccessToken: () => token,
      refreshAccessToken: async () => {
        refreshes++;
        if (refreshes === 2) { secondStarted.resolve(); await secondRefresh.promise; }
        token = refreshes === 1 ? "one" : "two";
        return token;
      },
    });
    const oldestRequest = client.get("/oldest");
    await oldestSent.promise;
    await client.get("/first");
    const newerRequest = client.get("/second");
    await secondStarted.promise;
    oldest.resolve();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(oldestRetried, false);
    secondRefresh.resolve();
    await Promise.all([oldestRequest, newerRequest]);
    assert.equal(refreshes, 2);
  });

  await t.test("refresh failure rejects all waiters and notification errors do not replace it", async () => {
    const gate = deferred();
    const allOld = deferred();
    let oldCalls = 0;
    let notifications = 0;
    const failure = new Error("refresh failed");
    const client = clientWithAdapter(() => { if (++oldCalls === 2) allOld.resolve(); return { status: 401 }; });
    attachAuthInterceptors(client, {
      getAccessToken: () => "old",
      refreshAccessToken: () => gate.promise,
      onRefreshFailure: async () => { notifications++; throw new Error("notification failed"); },
    });
    const results = Promise.allSettled([client.get("/one"), client.get("/two")]);
    await allOld.promise;
    gate.reject(failure);
    for (const result of await results) assert.equal(result.reason, failure);
    assert.equal(notifications, 1);
  });

  await t.test("cancelling one waiter rejects promptly without cancelling the shared refresh", async () => {
    let token = "old";
    const gate = deferred();
    const oldSent = deferred();
    let oldCalls = 0;
    const sends = [];
    const controller = new AbortController();
    const client = clientWithAdapter((config) => {
      sends.push(config.url);
      if (token === "old") { if (++oldCalls === 2) oldSent.resolve(); return { status: 401 }; }
      return { data: "ok" };
    });
    attachAuthInterceptors(client, { getAccessToken: () => token, refreshAccessToken: async () => { await gate.promise; token = "new"; return token; } });
    const cancelled = assert.rejects(client.get("/cancel", { signal: controller.signal }), (error) => axios.isCancel(error));
    const remaining = client.get("/keep");
    await oldSent.promise;
    // Let both response handlers attach to the shared refresh before aborting.
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort();
    await cancelled;
    gate.resolve();
    assert.equal((await remaining).data, "ok");
    assert.equal(sends.filter((url) => url === "/cancel").length, 1);
  });

  await t.test("a refresh request on the same client bypasses refresh recursion", async () => {
    let refreshes = 0;
    const client = clientWithAdapter(() => ({ status: 401 }));
    attachAuthInterceptors(client, { getAccessToken: () => "old", refreshAccessToken: async () => {
      refreshes++;
      await client.post("/refresh", {}, { skipAuth: true });
      return "unreachable";
    } });
    await assert.rejects(client.get("/protected"));
    assert.equal(refreshes, 1);
  });

  await t.test("invalid refresh results reject and refreshed CSRF headers are read again", async () => {
    const invalid = clientWithAdapter(() => ({ status: 401 }));
    attachAuthInterceptors(invalid, { getAccessToken: () => "old", refreshAccessToken: async () => null });
    await assert.rejects(invalid.get("/private"), /refreshAccessToken must return/);
    let token = "old";
    let csrfToken = "old-csrf";
    const seen = [];
    const client = clientWithAdapter((config) => {
      seen.push(config.headers.get("X-XSRF-TOKEN"));
      assert.equal(config.xsrfCookieName, null, "hook CSRF must prevent Axios cookie-header replacement");
      return { status: token === "old" ? 401 : 200 };
    });
    attachAuthInterceptors(client, {
      getAccessToken: () => token,
      refreshAccessToken: async () => { token = "new"; csrfToken = "new-csrf"; return token; },
      csrf: { getToken: () => csrfToken },
    });
    await client.post("/private", {});
    assert.deepEqual(seen, ["old-csrf", "new-csrf"]);
  });

  await t.test("cleanup while refresh is pending prevents the old request from being replayed", async () => {
    const gate = deferred();
    const started = deferred();
    let sends = 0;
    const client = clientWithAdapter(() => { sends++; return { status: 401 }; });
    const cleanup = attachAuthInterceptors(client, {
      getAccessToken: () => "old",
      refreshAccessToken: async () => { started.resolve(); return gate.promise; },
    });
    const request = assert.rejects(client.get("/private"));
    await started.promise;
    cleanup();
    gate.resolve("new");
    await request;
    assert.equal(sends, 1);
    attachAuthInterceptors(client, { getAccessToken: () => "other" })();
  });

  await t.test("an asynchronous token lookup does not reattach a token superseded by refresh", async () => {
    const lookup = deferred();
    const lookupStarted = deferred();
    let token = "old";
    let reads = 0;
    const client = clientWithAdapter((config) => ({ status: config.headers.get("Authorization") === "Bearer old" ? 401 : 200 }));
    attachAuthInterceptors(client, {
      getAccessToken: () => { if (++reads === 1) { lookupStarted.resolve(); return lookup.promise; } return token; },
      refreshAccessToken: async () => { token = "new"; return token; },
    });
    const pending = client.get("/slow-lookup");
    await lookupStarted.promise;
    await client.get("/refresh-first");
    lookup.resolve("old");
    assert.equal((await pending).config.headers.get("Authorization"), "Bearer new");
  });

  await t.test("relative browser baseURL resolution is isolated from Node globals", async () => {
    const script = `
      import assert from "node:assert/strict";
      import axios from "axios";
      import { attachAuthInterceptors } from "./src/api/auth/attachAuthInterceptors.js";
      globalThis.window = { location: { href: "https://app.example.com/page" } };
      const client = axios.create({ baseURL: "/api", adapter: async config => ({ config, status: 200, headers: {}, data: null }) });
      attachAuthInterceptors(client, { getAccessToken: () => "access" });
      assert.equal((await client.get("/private")).config.headers.get("Authorization"), "Bearer access");
      assert.equal((await client.get("https://other.example/private")).config.headers.get("Authorization"), undefined);
      console.log("relative origin fixture passed");
    `;
    await writeFile(join(directory, "browser-origin-fixture.mjs"), script);
    const result = spawnSync(CLI_NODE_BINARY, [join(directory, "browser-origin-fixture.mjs")], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  });

  await t.test("real local HTTP verifies generated methods, refresh, body/config forwarding and CSRF", async () => {
    const requests = [];
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      requests.push({ url: request.url, method: request.method, body, headers: request.headers });
      response.setHeader("Content-Type", "application/json");
      if (request.url === "/private" && request.headers.authorization !== "Bearer new") response.statusCode = 401;
      response.end(JSON.stringify({ url: request.url, method: request.method, body, csrf: request.headers["x-xsrf-token"] }));
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    apiClient.defaults.baseURL = `http://127.0.0.1:${server.address().port}`;
    apiClient.defaults.adapter = axios.getAdapter("http");
    apiClient.defaults.proxy = false;
    let token = "old";
    const cleanup = attachAuthInterceptors(apiClient, { getAccessToken: () => token, refreshAccessToken: async () => { token = "new"; return token; }, csrf: { getToken: () => "csrf" } });
    assert.equal((await apiClient.get("/private")).status, 200);
    assert.equal((await exampleApi.getAll({ page: 2 }, { headers: { "X-Test": "forwarded" } })).url, "/examples?page=2");
    assert.equal((await exampleApi.getById("a/b")).url, "/examples/a%2Fb");
    assert.equal(JSON.parse((await exampleApi.create({ name: "created" })).body).name, "created");
    assert.equal((await exampleApi.update("1", { name: "updated" })).method, "PUT");
    assert.equal((await exampleApi.patch("1", {})).csrf, "csrf");
    assert.equal((await exampleApi.remove("1")).method, "DELETE");
    assert.equal(requests.find((request) => request.url.includes("page=")).headers["x-test"], "forwarded");
    cleanup();
  });

  await t.test("generated authentication makes real HTTP requests on the selected CLI runtime", async () => {
    await writeFile(join(directory, "runtime-http-fixture.mjs"), `
      import assert from "node:assert/strict";
      import { createServer } from "node:http";
      import { apiClient } from "./src/api/apiClient.js";
      import { attachAuthInterceptors } from "./src/api/auth/attachAuthInterceptors.js";
      const server = createServer((req, res) => {
        res.setHeader("Content-Type", "application/json");
        if (req.headers.authorization !== "Bearer new") res.statusCode = 401;
        res.end(JSON.stringify({ csrf: req.headers["x-xsrf-token"] }));
      });
      await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
      try {
        apiClient.defaults.baseURL = "http://127.0.0.1:" + server.address().port;
        apiClient.defaults.proxy = false;
        let token = "old";
        let refreshes = 0;
        attachAuthInterceptors(apiClient, {
          getAccessToken: () => token,
          refreshAccessToken: async () => { refreshes++; token = "new"; return token; },
          csrf: { getToken: () => "csrf" },
        });
        const response = await apiClient.post("/private", { value: 1 });
        assert.equal(response.status, 200);
        assert.equal(response.data.csrf, "csrf");
        assert.equal(refreshes, 1);
        console.log("HTTP auth fixture passed on " + process.version);
      } finally { await new Promise(resolve => server.close(resolve)); }
    `);
    const result = spawnSync(CLI_NODE_BINARY, [join(directory, "runtime-http-fixture.mjs")], { encoding: "utf8", timeout: 15000 });
    assert.equal(result.status, 0, result.stderr);
    t.diagnostic(result.stdout.trim());
  });
});
