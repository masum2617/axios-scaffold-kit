# axios-scaffold-kit

Generate an editable JavaScript Axios API starter in an existing project, with optional bearer authentication, token refresh, and CSRF hooks.

> **Available on npm:** [axios-scaffold-kit@0.1.0](https://www.npmjs.com/package/axios-scaffold-kit/v/0.1.0). Authentication is disabled by default.

The generator copies source files into your application. You own and edit those files; your application imports local code and Axios, not a runtime library from axios-scaffold-kit. This independent project is not affiliated with or endorsed by Axios.

## Contents

- [Requirements](#requirements)
- [Installation and quick start](#installation-and-quick-start)
- [Generated structure and where to edit](#generated-structure-and-where-to-edit)
- [Make requests](#make-requests)
- [Add your own API module](#add-your-own-api-module)
- [Optional authentication](#optional-authentication)
- [Try a real public API](#try-a-real-public-api)
- [Installation behavior and file safety](#installation-behavior-and-file-safety)
- [Troubleshooting](#troubleshooting)
- [Development and verification](#development-and-verification)
- [Updates, contributions, and releases](#updates-contributions-and-releases)

## Requirements

- Node.js **16 or later** to run the generator.
- An existing project with a valid `package.json`; run the CLI from that project's root.
- JavaScript ES-module support through your application runtime or build tooling.
- npm on `PATH` and registry access when Axios needs installation. Automatic installation supports standalone npm projects.

Contributor tests require Node.js 22 or later; users running the generator do not need the contributor test runner. There is no generator build step or runtime dependency installation needed to run its source.

## Installation and quick start

For an existing project, run this from its root folder, where `package.json` is located:

```sh
cd /path/to/your-application
npx axios-scaffold-kit init
```

For a new or empty folder without `package.json`, initialize the project first:

```sh
cd /path/to/your-new-project
npm init -y
npx axios-scaffold-kit init
```

If `package.json` is missing, the CLI prints these steps and stops without installing Axios or generating files. It does not run `npm init` for you, even with `-y`/`--yes`.

`npm install` alone installs the generator; `init` is the command that creates the starter files.

If Axios is missing, setup asks:

```text
Axios was not found in package.json.
Installing it may update package.json, the lockfile, and node_modules.
Install Axios? (y/N)
```

Enter `y`/`yes` to continue. Enter `n`/`no`, press Enter, or close input to cancel without generating files or running npm. Invalid answers repeat the question; Ctrl+C cancels with exit status 130.

For unattended setup, explicitly authorize missing-Axios installation:

```sh
npx axios-scaffold-kit init -y
# Equivalent: init --yes
```

npm may separately ask to download the generator itself. That is different from permission to install Axios in your application. Existing direct Axios declarations skip our prompt and installation.

If you prefer keeping the generator as a development tool, use:

```sh
npm install --save-dev axios-scaffold-kit
npx axios-scaffold-kit init
```

### Try the local executable

To try the source checkout, clone the repository and invoke its executable from a disposable target project's root containing a package.json:

```sh
cd /path/to/your-test-project
node /absolute/path/to/axios-scaffold-kit/bin/axios-scaffold-kit.js init
```

Run `--help` for usage. No arguments also show help. Supported setup forms are `init`, `init -y`, and `init --yes`; unknown commands or extra arguments fail.

### Configure the starter

1. Set your real API base URL in `src/api/apiClient.js`; the generated URL is an example.
2. Replace `API_PREFIX = "/examples"` in `src/api/exampleApi.js` with a real resource path, or add your own module as shown below.
3. Call an API method from your application. Generating files alone does not send requests or test your backend.
4. If needed, connect authentication in `src/api/auth/authConfig.js`. Otherwise leave it unchanged.

## Generated structure and where to edit

```text
src/api/
  apiClient.js
  exampleApi.js
  auth/
    authConfig.js
    attachAuthInterceptors.js
```

| File | Purpose | What you normally change |
| --- | --- | --- |
| `apiClient.js` | Creates the shared Axios instance with a 10-second timeout and connects optional auth. | Base URL, timeout, and ordinary Axios options such as cookie credentials when required. |
| `exampleApi.js` | Editable request examples that return `response.data`. | Endpoint paths, request methods, parameters, bodies, and names matching your API. |
| `auth/authConfig.js` | Supplies application-specific authentication hooks; defaults to empty options. | Access-token lookup, refresh endpoint/body/response parsing, token persistence, CSRF source, and failure handling. |
| `auth/attachAuthInterceptors.js` | Implements token attachment, refresh coordination, retry limits, cancellation, origin checks, and cleanup. | Usually leave it alone; edit it when deliberately changing interceptor mechanics. Each function has a purpose comment. |

No login endpoint, token store, framework router, environment-variable convention, or business logic is generated. Set the base URL before enabling authentication, because its API origin is captured during setup.

## Make requests

Import paths below assume the caller is directly inside `src/`; adjust them to the calling file. Relative imports must include `.js` when running directly with Node.

```js
import { exampleApi } from "./api/exampleApi.js";

async function loadItems() {
  try {
    const items = await exampleApi.getAll({ page: 1 });
    console.log(items);
  } catch (error) {
    console.error("Request failed:", error.response?.status, error.message);
  }
}

// Call from application startup, an event handler, or another appropriate entry point.
await loadItems();
```

### Example methods

All example methods return the server's `response.data`; the body shape belongs to your backend. Request failures reject normally. `config` is an optional Axios request configuration object.

| Method | HTTP request | Arguments |
| --- | --- | --- |
| `getAll(params = {}, config = {})` | GET resource collection | Query parameters, then request options. |
| `getById(id, config = {})` | GET resource by encoded ID | Resource ID, then request options. |
| `create(body, config = {})` | POST resource collection | Request body, then request options. |
| `update(id, body, config = {})` | PUT resource by ID | ID, replacement body, then request options. |
| `patch(id, body, config = {})` | PATCH resource by ID | ID, partial body, then request options. |
| `remove(id, config = {})` | DELETE resource by ID | ID, then request options. |

`getAll` takes query parameters from its first argument; that argument takes precedence over `config.params`. Other methods forward the request configuration directly.

Use the client when you need the full response, including status and headers:

```js
import { apiClient } from "./api/apiClient.js";

const response = await apiClient.get("/your-endpoint");
console.log(response.status, response.headers, response.data);
```

Cancellation uses normal Axios configuration:

```js
const controller = new AbortController();
const request = exampleApi.getAll({}, { signal: controller.signal });
controller.abort();
await request.catch((error) => console.log(error.message));
```

## Add your own API module

Create another file beside `exampleApi.js`, for example `src/api/usersApi.js`:

```js
import { apiClient } from "./apiClient.js";

export const usersApi = {
  getProfile: async (userId, config = {}) => {
    const response = await apiClient.get(
      `/users/${encodeURIComponent(userId)}`,
      config,
    );
    return response.data;
  },

  createUser: async (body, config = {}) => {
    const response = await apiClient.post("/users", body, config);
    return response.data;
  },
};
```

Replace these routes and payloads to match your backend. Import the same shared client into each resource module so enabled interceptors apply consistently. You may rename or delete the example module once your own modules are in place.

## Optional authentication

The client automatically calls `attachAuthInterceptors(apiClient, createAuthConfig(apiClient))`. Default empty options enable **no authentication interceptors, browser storage reads, or backend calls**.

Edit **`auth/authConfig.js`** to enable only the hooks your backend supports. Its comments show where to add your own code. Complete copyable examples and the internal helper reference are in [the authentication guide](docs/AUTHENTICATION.md).

| Function or option | Responsibility |
| --- | --- |
| `createAuthConfig(apiClient)` | Return application options using the existing client; do not import the client back into this file. |
| `getAccessToken()` | Return the current access token or `null`, synchronously or asynchronously. |
| `refreshAccessToken()` | Perform your backend refresh, persist the new token in your application, and return it. Requires token lookup. |
| `onRefreshFailure(error)` | Optionally clear application session state or notify the application when refresh fails. |
| `csrf.getToken(config)` | Obtain the request's CSRF token or `null`, synchronously or asynchronously; independent of bearer auth. |
| `csrf.headerName` | Expected CSRF header name; defaults to `X-XSRF-TOKEN`. |
| `attachAuthInterceptors(client, options)` | Register enabled request/response handlers and return cleanup. Advanced manual setup remains available. |
| `cleanupAuth()` | Remove the initial setup's interceptors before replacement; harmless with default empty options. |

Example browser-only bearer configuration, replacing `authConfig.js`:

```js
export function createAuthConfig(apiClient) {
  return {
    getAccessToken: () => sessionStorage.getItem("accessToken"),
  };
}
```

Login, refresh, and logout must use the same storage and key. This illustrates integration; it is not a recommendation to store tokens in browser storage. Both sessionStorage and localStorage are readable by JavaScript. Use your application's storage/security policy or existing token-store functions. No token store is generated.

```js
await apiClient.post("/your-login-endpoint", credentials, { skipAuth: true });
await apiClient.post("/without-generated-csrf", body, { skipCsrf: true });
```

These examples assume your application imports `apiClient` and supplies its own data. `skipAuth` bypasses generated bearer/refresh; `skipCsrf` independently bypasses generated CSRF. Neither suppresses cookies, removes explicit caller headers, or changes backend authorization.

Refresh uses one shared in-flight operation and retries each eligible request at most once. The guide explains failure handling, replayable-body requirements, separate refresh clients, and fixed-origin credential filtering. Cookie transport and server-side CSRF protection must be configured for your backend. Optional auth uses Axios's public AxiosHeaders API; Axios 1.20.0 was verified. Versions lacking that API fail clearly when enabling hooks; existing declarations are not upgraded.

Do not enable generated auth and also register another active manual setup on the same client. For runtime origin/options changes, call the appropriate cleanup, update the base URL, configure again, and retain the new cleanup. Source edits normally take effect after restart/reload.

## Try a real public API

In a disposable generated project, use [JSONPlaceholder](https://jsonplaceholder.typicode.com/):

1. In `apiClient.js`, set `baseURL: "https://jsonplaceholder.typicode.com"`.
2. In `exampleApi.js`, set `API_PREFIX = "/posts"`.
3. Leave authentication empty. This public API does not test token refresh or CSRF.
4. Create `src/api/testApi.js`:

```js
import { exampleApi } from "./exampleApi.js";

async function testApi() {
  try {
    console.log("One post:", await exampleApi.getById(1));
    console.log("Filtered:", await exampleApi.getAll({ userId: 1 }));
  } catch (error) {
    console.error("Request failed:", error.response?.status, error.message);
    process.exitCode = 1;
  }
}

await testApi();
```

For direct Node execution, the disposable project's package.json needs `"type": "module"`. From its root run `node src/api/testApi.js`; results appear in Terminal. In an existing frontend, call the same request functions from your application flow instead. JSONPlaceholder simulates writes; create/update/delete responses do not represent permanent changes.

## Installation behavior and file safety

- All output destinations and parent directories are checked before consent or installation. Existing generated destinations stop setup; symlink/non-directory output parents are rejected.
- Existing Axios declarations in dependencies, devDependencies, or optionalDependencies are preserved without npm. Detection uses package.json, not node_modules; install your existing dependencies through your normal project workflow if needed.
- Missing Axios is installed after consent as a production dependency using `npm install axios@^1.20.0 --save-prod`. The authoritative range is in `src/config/defaults.js`.
- npm may change package.json, lockfiles, and installed dependencies, following the project's normal npm configuration/lifecycle behavior. The generator does not delete node_modules wholesale or guarantee an unchanged dependency tree after installation.
- Peer-only Axios declarations require explicit installation. Automatic installation is refused for identified Yarn/pnpm projects or npm workspaces, including enclosing workspaces. Install Axios using the correct workflow first, then rerun generation with a direct declaration.
- Files are written exclusively after successful dependency handling. npm failure prevents generation. Later write failure reports completed writes and successful installation honestly; neither npm changes nor partial output are automatically rolled back.
- Noninteractive missing-Axios setup requires `-y`/`--yes`. Existing Axios permits noninteractive generation without consent flags.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No package.json found | For an existing project, use the folder containing package.json. For a new project, run `npm init -y`, then `npx axios-scaffold-kit init`. |
| Nothing prints after running a test file | Defining a function does not run it; call it, for example `await testApi()`, and print/handle its result. |
| `ERR_MODULE_NOT_FOUND` for a relative import | Include `.js` and resolve the path relative to the calling file. Beside exampleApi.js, import `./exampleApi.js`. |
| Import/module syntax errors in direct Node tests | Use a project configured for ES modules. In a disposable npm test project, `npm pkg set type=module` enables that mode; existing applications should follow their runtime/build configuration. |
| HTTP `404` | Replace the example base URL and `/examples` prefix; check the combined URL and actual backend route. |
| HTTP `401`/`403` | Check the backend's authentication/authorization contract. Empty authConfig supplies no credentials; `403` does not trigger refresh. |
| Duplicate authentication configuration | Choose generated configuration or manual setup; clean up the active setup before replacing it. |
| Browser reports CORS/cookie errors | Configure the backend's allowed origin/credentials/cookies; client-side scaffolding cannot fix server policy. |
| Existing destination conflict | Review and integrate changes manually or generate in a fresh project. There is no overwrite/upgrade flag. |
| Missing Axios without terminal input | Rerun interactively or explicitly authorize installation with `init -y`. |

## Development and verification

Use Node.js 22+ in the generator repository. `npm test` is offline; without an Axios fixture it explicitly skips the real-Axios suite, so that alone is not full authentication verification.

```sh
node scripts/prepare-auth-fixture.js
# Set the temporary path printed by the script:
export AXIOS_TEST_DIRECTORY="/absolute/path/printed/by/the/script"
npm test
npm pack --dry-run --ignore-scripts
```

Preparation installs Axios in a disposable project using the shared range; it may access npm. The tests then use fake npm, controlled Axios adapters, and local HTTP servers rather than live backends. `npm run test:auth` runs just the integration suite and requires the fixture path. No repository dependencies or build/lint tools are installed.

Keep the test runner on Node 22+ and select a consumer runtime with `CLI_NODE_BINARY="/absolute/path/to/node" npm test`. Generated syntax, default-import, recipe, and HTTP child fixtures use that selected executable. The generator itself supports Node 16+.

Verification uses disposable projects, controlled HTTP servers, and real Axios fixtures. Node 16.0.0 and Axios 1.20.0 have been exercised; this does not guarantee compatibility with every future runtime or dependency resolution. See [the release guide](docs/RELEASING.md) for package checks and the older npm local-tarball fallback.

For browser verification, run `node scripts/serve-auth-browser-fixture.js` with the same fixture, open its localhost URL, and check for PASS; Ctrl+C stops it. Browser checks are separate from the Node test suite.

The read-only [CI workflow](.github/workflows/ci.yml) configures Node 22 tests on Linux/macOS/Windows plus minimum/latest-patch Node 16 CLI checks on Linux and real Axios integration checks. Remote results are established only after those jobs pass. No workflow publishes npm packages or GitHub Releases.

## Updates, contributions, and releases

Generated files are application-owned: new generator versions do not update them automatically. Compare templates/release notes and apply relevant changes manually. Maintain Axios through your application's dependency workflow.

`0.1.0` includes JavaScript ES modules, fixed src/api output, optional authentication hooks, and standalone npm installation. TypeScript is targeted for 0.2.0. Output customization, workspace-aware installation, proactive refresh, and cross-tab coordination remain future work.

See [CONTRIBUTING.md](CONTRIBUTING.md) for issues and pull requests, [CHANGELOG.md](CHANGELOG.md) for version history, and [docs/RELEASING.md](docs/RELEASING.md) for the manual GitHub/npm release process. The [release notes](docs/releases/0.1.0.md) describe the initial version and its publication status. Version `0.1.0` is published; [patch `0.1.1`](docs/releases/0.1.1.md) is prepared and awaiting publication. Future CLI fixes require a new npm version; updating the GitHub README alone does not update the published package.

## License

[MIT](LICENSE), including source templates. Preserve applicable copyright/license notices when redistributing covered code.
