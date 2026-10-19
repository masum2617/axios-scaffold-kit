# axios-scaffold-kit

An editable Axios API structure for JavaScript and TypeScript projects, generated from the terminal.

> **Status: project initialization.** The CLI and templates are not implemented, and this project has not been published to npm. The workflow below describes the intended first release; it is not available to run yet.

## Why this project?

Starting a project often means repeating the same API setup: creating an Axios client, choosing a folder structure, and writing example request functions. axios-scaffold-kit aims to generate that starting point so developers can connect their own endpoints and continue building.

Generated code belongs in your source tree. You can inspect, edit, and commit it alongside the rest of your application.

This is an independent project and is not affiliated with or endorsed by Axios.

## Installation and quick start

**Planned command, after the first npm release:**

```sh
npx axios-scaffold-kit@latest init
```

Run it from the root of an existing npm-managed project. The CLI is intended to:

1. Ask whether to generate JavaScript or TypeScript.
2. Ask for an output directory, defaulting to `src/api`.
3. Check for conflicting files and stop rather than overwrite them.
4. Install Axios with npm if it is not already declared in the project, preserving an existing installation.
5. Generate the selected files and explain what to configure next.

The generator will not need to remain in your project's dependencies. Axios will be a dependency of your application.

The first release targets modern ES module projects using `import` and `export`. It will not require React, Vite, Next.js, or another UI framework. Supported Node.js versions will be documented when the CLI is implemented and tested. TypeScript output assumes the project already supports TypeScript; the generator will not configure a compiler.

## Planned generated structure

```text
src/api/
  apiClient.js
  exampleApi.js
  auth/
    configureAuth.js
    tokenStore.js
```

TypeScript output will use equivalent `.ts` files.

| File | Responsibility |
| --- | --- |
| `apiClient` | Shared Axios client with configurable base URL and timeout. |
| `exampleApi` | Editable GET, POST, PUT, PATCH, and DELETE examples, including query parameters, request bodies, and cancellation. |
| `auth/configureAuth` | Optional authentication setup and refresh handling. |
| `auth/tokenStore` | Example in-memory token storage that developers can replace. |

## Planned usage

After generation, set the base URL in `apiClient` using your project's configuration conventions. Replace the example endpoints and request functions with your own API contract.

The shared client will preserve the full Axios response. Example API functions will return `response.data` for convenient application use. Developers can return the full response from their own functions when they need status codes or headers.

Authentication will be disabled by default. Public API calls will work without configuring a token store or refresh endpoint. Optional authentication will support developer-supplied token access, refresh behavior, and session-expiry handling. Individual requests will be able to opt out through a documented custom `skipAuth` option.

Cookie credentials will be configured separately from bearer-token behavior. Cookie issuance and backend authorization remain application responsibilities.

Copyable request and authentication examples will be added with the tested implementation, so this README matches the actual generated interfaces.

## Updates and ownership

New generator releases will affect future generation. They will not automatically modify files already generated in your application.

Relevant template fixes will be documented in release notes so existing users can apply them manually. Axios updates remain part of your application's dependency maintenance.

## Repository layout

The current repository contains package metadata, documentation, contribution guidance, and a license. No application code or dependencies have been added.

The planned implementation layout is:

```text
bin/                  CLI executable
src/                  Prompts, validation, installation, and generation
templates/
  javascript/         JavaScript source templates
  typescript/         TypeScript source templates
tests/                CLI and generated-template verification
```

These directories will be introduced when implementation begins. The npm package's `files` allowlist reserves `bin/`, `src/`, and `templates/` for distribution; npm also includes package metadata, the README, and the license.

## Development and contributions

Contributions through issues and pull requests are welcome once the GitHub repository is available. Please discuss larger changes before starting work. See [CONTRIBUTING.md](CONTRIBUTING.md).

There are no build or test commands yet. They will be documented when implementation and verification are added.

## Release status

The initial development version is `0.1.0`. `package.json` currently has `private: true` to prevent publishing this unfinished scaffold. This does not make the GitHub repository private or change its license.

Before the first release:

- Implement and verify both language templates, optional authentication, and safe file generation.
- Add the CLI `bin` entry, supported Node.js versions, and real test commands.
- Add the actual GitHub repository, issue tracker, and homepage URLs to `package.json`.
- Review the package contents with `npm pack --dry-run` and test the archive produced by `npm pack` in disposable projects.
- Update this README with verified installation and usage examples, and add release notes.
- Enable npm account two-factor authentication, confirm package-name availability, and deliberately remove the publishing block.
- Publish the reviewed version and create a matching GitHub release.

No automatic publishing workflow is configured.

## License

Licensed under the [MIT License](LICENSE), including the source templates when they are added. Preserve the applicable copyright and license notices when redistributing covered code.
