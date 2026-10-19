# axios-scaffold-kit

Generate an editable Axios API starter for your project.

> **Development milestone:** local JavaScript generation works. This package has not been published to npm. TypeScript output, interactive choices, automatic Axios installation, and optional authentication are planned.

## Why this project?

Starting a project often means repeating the same API setup: creating an Axios client, choosing a folder structure, and writing example request functions. axios-scaffold-kit generates that starting point so you can connect your own endpoints.

Generated files live in your application. Inspect, edit, and commit them like any other source code. The generator is not a runtime dependency of your application.

This independent project is not affiliated with or endorsed by Axios.

## Requirements

- Node.js 22 or later to run the generator. Initial verification uses Node.js 22; other major versions have not yet been verified.
- An existing project with a valid `package.json` in its root directory.
- A project that supports JavaScript ES modules through its runtime or build tooling.
- Axios in your application to execute the generated requests. The current generator does not install it.

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

If either file exists, generation stops before writing either file. Existing unrelated files, dependencies, and package metadata are preserved. Other filesystem failures are reported; partial output is not automatically rolled back.

No arguments displays help. Unknown commands or extra arguments fail with a nonzero exit status. This milestone has no language prompts, custom output option, or authentication setup.

**After generation:**

1. If Axios is missing, install it in the target project with `npm install axios`.
2. Replace the example base URL in `src/api/apiClient.js` with your API's URL or your own configuration value.
3. Replace `/examples` and the example methods in `src/api/exampleApi.js` to match your backend contract.

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
src/project/                Validates the target package.json
src/config/                 Owns shared generation defaults
src/generate/               Prepares templates, checks conflicts, creates files
templates/javascript/       Editable source templates
tests/cli/                  Tests the executable against temporary projects
```

The npm `bin` entry maps the command name to the executable. The executable delegates to the CLI, which validates the project before generating anything. Template locations are resolved relative to the generator itself, so execution does not depend on being inside this repository.

The timeout is inserted from `src/config/defaults.js`. Exclusive file creation prevents overwriting files that appear between preflight checks and writing.

## Development and verification

Run from this repository:

```sh
npm test
npm pack --dry-run
```

Tests use Node's built-in test runner and disposable projects. They cover generation, output syntax, manifest validation, conflict protection, preserved project data, help, invalid arguments, and filesystem failure reporting. They do not install Axios, contact live APIs, or prove HTTP behavior.

Package archive extraction and CLI execution outside the checkout are verified separately during milestone validation. No lint or build commands are configured yet. Contributions are described in [CONTRIBUTING.md](CONTRIBUTING.md).

## Planned first-release capabilities

- Choose JavaScript or TypeScript and an output directory.
- Install Axios automatically when missing, preserving existing declarations.
- Optional authentication that is inactive until configured, with in-memory token storage, public-request opt-out, and bounded refresh handling.
- Tested installation and usage instructions for a published npm CLI.

The intended published command is `npx axios-scaffold-kit@latest init`. It is **not available from this project on npm yet**; use the local executable above.

## Updates and release status

New generator releases affect future output. They do not automatically change files already generated in your application. Apply relevant template fixes manually using future release notes; maintain Axios through your application's dependency workflow.

The development version is `0.1.0`. `private: true` prevents publishing this unfinished package; it does not make this GitHub repository private. Release preparation will include tested language templates, dependency installation and authentication, refreshed usage documentation, package archive checks, release notes, npm two-factor authentication, and an explicit publishing decision.

No automatic publishing workflow is configured.

## License

Licensed under the [MIT License](LICENSE), including source templates. Preserve applicable copyright and license notices when redistributing covered code.
