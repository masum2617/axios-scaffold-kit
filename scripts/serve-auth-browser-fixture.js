import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { DEFAULT_TIMEOUT_MS } from "../src/config/defaults.js";

if (!process.env.AXIOS_TEST_DIRECTORY) {
  throw new Error("Set AXIOS_TEST_DIRECTORY to a prepared disposable Axios fixture.");
}
const require = createRequire(join(resolve(process.env.AXIOS_TEST_DIRECTORY), "package.json"));
const axiosBrowser = join(dirname(require.resolve("axios/package.json")), "dist/axios.min.js");
const authTemplate = new URL("../templates/javascript/auth/attachAuthInterceptors.js", import.meta.url);
const configTemplate = new URL("../templates/javascript/auth/authConfig.js", import.meta.url);
const clientTemplate = new URL("../templates/javascript/apiClient.js", import.meta.url);
const guide = await readFile(new URL("../docs/AUTHENTICATION.md", import.meta.url), "utf8");
const refreshRecipe = guide.split("<!-- recipe:refresh -->")[1].match(/```js\n([\s\S]*?)```/)[1];
const html = `<!doctype html><meta charset="utf-8"><title>Authentication browser fixture</title>
<pre id="result">Running…</pre>
<script src="/axios.js"></script>
<script type="importmap">{"imports":{"axios":"/axios-module.js"}}</script>
<script type="module">
import { attachAuthInterceptors } from "/attachAuthInterceptors.js";
import { apiClient as defaultClient, cleanupAuth as cleanupDefault } from "/apiClient.js";
const result = document.querySelector("#result");
function check(value, message) { if (!value) throw new Error(message); }
try {
  check(defaultClient.interceptors.request.handlers.filter(Boolean).length === 0, "default configuration enabled auth");
  check(!(await defaultClient.get("/public")).data.authorization, "default request received auth");
  cleanupDefault();
  sessionStorage.setItem("axios-scaffold-fixture-accessToken", "old");
  const configured = await import("/configured/apiClient.js");
  check((await configured.apiClient.get("/private")).status === 200, "automatic config refresh failed");
  check(sessionStorage.getItem("axios-scaffold-fixture-accessToken") === "new", "refresh did not persist token");
  configured.cleanupAuth();
  sessionStorage.removeItem("axios-scaffold-fixture-accessToken");
  document.cookie = "AXIOS-SCAFFOLD-FIXTURE-XSRF=fixture-cookie; Path=/";
  const client = axios.create({ baseURL: "/api", xsrfCookieName: "AXIOS-SCAFFOLD-FIXTURE-XSRF" });
  let token = "old";
  let refreshes = 0;
  const cleanup = attachAuthInterceptors(client, {
    getAccessToken: () => token,
    refreshAccessToken: async () => { refreshes++; token = "new"; return token; },
    csrf: { getToken: () => "browser-csrf" },
  });
  const response = await client.get("/private");
  check(response.status === 200 && refreshes === 1, "XHR refresh failed");
  const publicResponse = await client.post("/public", {}, { skipAuth: true });
  check(!publicResponse.data.authorization && publicResponse.data.csrf === "browser-csrf", "public bypass/CSRF failed");
  const bypass = await client.post("/public", {}, { skipCsrf: true });
  check(bypass.data.authorization === "Bearer new" && !bypass.data.csrf, "CSRF bypass failed");
  const foreign = await client.post(location.origin.replace("127.0.0.1", "localhost") + "/api/public", {});
  check(!foreign.data.authorization && !foreign.data.csrf, "foreign origin received generated headers");
  cleanup();
  check(!(await client.get("/public")).data.authorization, "cleanup failed");
  document.cookie = "AXIOS-SCAFFOLD-FIXTURE-XSRF=; Max-Age=0; Path=/";
  result.textContent = "PASS: default disabled configuration, automatic config/refresh/persistence, real browser XHR, relative baseURL, public requests, independent CSRF, foreign-origin protection, cleanup.";
} catch (error) { result.textContent = "FAIL: " + error.message; }
</script>`;

const server = createServer(async (request, response) => {
  try {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-XSRF-TOKEN");
    if (request.method === "OPTIONS") { response.end(); return; }
    const paths = {
      "/axios.js": axiosBrowser,
      "/attachAuthInterceptors.js": authTemplate,
      "/auth/attachAuthInterceptors.js": authTemplate,
      "/configured/auth/attachAuthInterceptors.js": authTemplate,
      "/auth/authConfig.js": configTemplate,
    };
    if (paths[request.url]) {
      response.setHeader("Content-Type", "text/javascript");
      response.end(await readFile(paths[request.url]));
    } else if (["/apiClient.js", "/configured/apiClient.js"].includes(request.url)) {
      response.setHeader("Content-Type", "text/javascript");
      const source = await readFile(clientTemplate, "utf8");
      response.end(source.replaceAll("__DEFAULT_TIMEOUT_MS__", String(DEFAULT_TIMEOUT_MS)).replace('"https://api.example.com"', '"/api"'));
    } else if (request.url === "/configured/auth/authConfig.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(refreshRecipe.replaceAll('"accessToken"', '"axios-scaffold-fixture-accessToken"'));
    } else if (request.url === "/axios-module.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end("export default window.axios;");
    } else if (request.url.startsWith("/api/")) {
      response.setHeader("Content-Type", "application/json");
      if (request.url === "/api/private" && request.headers.authorization !== "Bearer new") response.statusCode = 401;
      response.end(JSON.stringify({ authorization: request.headers.authorization, csrf: request.headers["x-xsrf-token"], ...(request.url === "/api/your-refresh-endpoint" ? { accessToken: "new" } : {}) }));
    } else {
      response.setHeader("Content-Type", "text/html");
      response.end(html);
    }
  } catch (error) {
    response.statusCode = 500;
    response.end(error.message);
  }
});
server.listen(0, "127.0.0.1", () => {
  console.log(`Open http://127.0.0.1:${server.address().port}/ in a browser. Ctrl+C stops the disposable fixture.`);
});
