# axios-scaffold-kit

Generate an editable Axios API starter for your project.

> **Development milestone:** local JavaScript generation and automatic Axios installation work. This package has not been published to npm. TypeScript output, interactive choices, and optional authentication are planned.

## Why this project?

Starting a project often means repeating the same API setup: creating an Axios client, choosing a folder structure, and writing example request functions. axios-scaffold-kit generates that starting point so you can connect your own endpoints.

Generated files live in your application. Inspect, edit, and commit them like any other source code. The generator is not a runtime dependency of your application.

This independent project is not affiliated with or endorsed by Axios.

## Requirements

- Node.js 16 or later to run the generator. Contributor tests require Node.js 22 or later; application developers running the CLI do not need that test runtime.
- An existing project with a valid `package.json` in its root directory. Automatic installation currently supports standalone npm projects.
- A project that supports JavaScript ES modules through its runtime or build tooling.
- npm on `PATH` and registry access when Axios is missing. Existing Axios declarations are preserved without running npm.

No dependencies or build step are needed to run this generator from source.

## Try the local CLI

Clone this repository and run the executable from the root of a disposable target project. Replace `/absolute/path/to` with your local clone's parent directory:

```sh
cd /path/to/your-test-project
node /absolute/path/to/axios-scaffold-kit/bin/axios-scaffold-kit.js --help
node /absolute/path/to/axios-scaffold-kit/bin/axios-scaffold-kit.js init
```

The command uses your **current directory** as the target project. It creates:

```text
src/api/
  apiClient.js
  exampleApi.js
```

If either file exists, the command stops before running npm or writing either file. Templates are prepared first, then missing Axios is installed, then starter files are written. Exclusive file creation also prevents overwrites if a destination appears during installation.

When Axios is already declared in `dependencies`, `devDependencies`, or `optionalDependencies`, its version and location are preserved and npm is not run. Detection uses the manifest, not `node_modules`; a declaration does not prove dependencies have been downloaded. If needed, use your project's normal dependency-installation workflow.

When missing, Axios is installed as a production dependency with `npm install axios@^1.20.0 --save-prod`. The range is maintained in `src/config/defaults.js`. npm may modify `package.json`, lockfiles, and installed dependencies, and follows the project's normal npm configuration and lifecycle behavior. The generator does not attempt to roll back npm changes.

If npm fails or is terminated, starter files are not generated. If npm succeeds but file writing later fails, the error explicitly reports that installation succeeded and describes any completed file writes. Partial output is not automatically rolled back.

A peer-only Axios declaration stops the command with instructions to install it explicitly. Automatic installation is also refused when the target or an ancestor identifies Yarn/pnpm through `packageManager` or lock/workspace files, or declares npm workspaces. Install Axios with the intended package manager first; generation can then proceed without invoking npm once a direct declaration exists. Workspace-aware installation and other package managers are not implemented yet.

No arguments displays help. Unknown commands or extra arguments fail with a nonzero exit status. This milestone has no language prompts, custom output option, or authentication setup.

**After generation:**

1. Replace the example base URL in `src/api/apiClient.js` with your API's URL or your own configuration value.
2. Replace `/examples` and the example methods in `src/api/exampleApi.js` to match your backend contract.

Generating files does not contact your API or verify your endpoints.

## Use the generated files

The shared client is a named export, created with `axios.create`. It has a configurable base URL and a generated 10-second timeout, without authentication interceptors or cookie configuration.

The example API is also a named export. The following application code assumes imports relative to `src/`; adapt the path to your caller:

```js
import { exampleApi } from "./api/exampleApi.js";

const items = await exampleApi.getAll({ page: 1 });
const item = await exampleApi.getById("example-id");
const created = await exampleApi.create({ name: "Example" });
await exampleApi.update("example-id", { name: "Updated example" });
await exampleApi.patch("example-id", { name: "Renamed example" });
await exampleApi.remove("example-id");
```

These are editable examples, not assumptions about your API's routes or payloads. All methods return `response.data`, whose shape is determined by your server. Request errors reject normally; handle them in your application.

Each method accepts an optional Axios configuration object as its last argument. For instance, cancellation uses the normal `AbortController` signal:

```js
const controller = new AbortController();
const request = exampleApi.getAll({ page: 1 }, { signal: controller.signal });

// Cancel when the request is no longer needed; handle the rejection in your caller.
controller.abort();
await request.catch((error) => {
  console.log(error.message);
});
```

`getAll(params, config)` uses its first argument as query parameters. The other methods forward the configuration directly to Axios. Use the shared client when you need the full Axios response, including status and headers:

```js
import { apiClient } from "./api/apiClient.js";

const response = await apiClient.get("/your-endpoint");
console.log(response.status, response.data);
```

The generated code uses no framework-specific environment variables, router, or state library.

## How the generator works

```text
bin/axios-scaffold-kit.js    Starts the CLI and handles failure exit status
src/cli/                    Handles commands and terminal messages
src/project/                Reads the manifest and checks dependency/install boundaries
src/config/                 Owns shared generation defaults
src/install/                Starts npm and waits for installation success or failure
src/generate/               Prepares templates, checks conflicts, then writes files
templates/javascript/       Editable source templates
tests/cli/                  Tests the executable against temporary projects
tests/install/              Tests dependency handling and installation failures
tests/helpers/              Provides isolated projects and an offline fake npm
```

The npm `bin` entry maps the command name to the executable. The executable delegates to the CLI, which reads and validates the project once, prepares output, preserves or installs Axios, and writes the starter. Template locations are resolved relative to the generator itself, so execution does not depend on being inside this repository.

The timeout is inserted from `src/config/defaults.js`. Exclusive file creation prevents overwriting files that appear between preflight checks and writing.

## Development and verification

Use Node.js 22 or later and run from this repository:

```sh
npm test
npm pack --dry-run
```

Tests use Node's built-in test runner and disposable projects. They cover generation, output syntax, manifest validation, conflict protection before npm runs, preserved declarations and lockfiles, package-manager/workspace boundaries, help, invalid arguments, and installation/file-writing failures. Routine tests put a fake npm executable on `PATH`; they do not download packages or contact live APIs. The installer's fixed Windows command is checked through a process seam; actual Windows execution has not been verified.

By default, CLI subprocesses and generated-file syntax checks use the same Node binary as the test runner. To check an older CLI runtime, keep Node 22 or later active for `npm test` and supply the absolute path to the other binary:

```sh
CLI_NODE_BINARY="/absolute/path/to/node16/bin/node" npm test
```

`CLI_NODE_BINARY` is a test-only setting. It does not switch your default runtime or change the generated code. Node 22 runs the testing tools, while those tools launch the CLI and syntax checks using the selected binary.

The 38-test behavioral suite has been verified with a Node 22.23.1 test runner and these CLI runtimes on macOS ARM64:

| CLI runtime | Behavioral suite |
| --- | --- |
| Node 16.0.0 | Passed |
| Node 16.20.2 | Passed |
| Node 20.20.2 | Passed |
| Node 22.23.1 | Passed |
| Node 24.3.0 | Passed |

The declared range is `>=16`; the table records the versions actually checked, not every release in that range. Separate smoke checks used the packed archive to install Axios 1.20.0 in disposable projects on Node 16.0.0/npm 7.10.0 and Node 16.20.2/npm 8.19.4, with strict dependency-engine checking enabled. Both runtimes successfully executed all six generated example methods against a local HTTP server, including parameter/body/configuration forwarding and preservation of the full client response. Regeneration with an existing dependency also preserved the manifest and lockfile without npm on `PATH`. These checks do not establish compatibility of future Axios releases or transitive dependencies.

Package archive extraction and CLI execution outside the checkout are verified separately during milestone validation. No lint or build commands are configured yet. Contributions are described in [CONTRIBUTING.md](CONTRIBUTING.md).

## Planned first-release capabilities

- Choose JavaScript or TypeScript and an output directory.
- Optional authentication that is inactive until configured, with in-memory token storage, public-request opt-out, and bounded refresh handling.
- Tested installation and usage instructions for a published npm CLI.

The intended published command is `npx axios-scaffold-kit@latest init`. It is **not available from this project on npm yet**; use the local executable above.

## Updates and release status

New generator releases affect future output. They do not automatically change files already generated in your application. Apply relevant template fixes manually using future release notes; maintain Axios through your application's dependency workflow.

The development version is `0.1.0`. `private: true` prevents publishing this unfinished package; it does not make this GitHub repository private. Release preparation will include tested language templates and authentication, continued installation verification, refreshed usage documentation, package archive checks, release notes, npm two-factor authentication, and an explicit publishing decision.

No automatic publishing workflow is configured.

## License

Licensed under the [MIT License](LICENSE), including source templates. Preserve applicable copyright and license notices when redistributing covered code.
