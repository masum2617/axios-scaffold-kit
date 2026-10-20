# Maintainer release guide

This project uses manual, reviewed releases. This document describes the process; it does not authorize commits, pushes, tags, account changes, GitHub Release creation, or npm publication. The package is currently blocked from publication with `private: true`.

## Understand the three release records

| Record | First release | Meaning |
| --- | --- | --- |
| npm package version | `0.1.0` | Installable generator distributed through npm. |
| Git tag | `v0.1.0` | Exact repository commit used for the release. |
| GitHub Release | `v0.1.0 — Initial JavaScript release` | Human-readable announcement and notes attached to the tag. |

Keep all three aligned. Never move a published version's tag to a different commit. Publish a new version for a fix rather than replacing an existing release's code.

## 1. Choose the version and scope

- First public release: `0.1.0`, JavaScript only with the documented fixed output directory and installation consent.
- Backward-compatible bug fixes: patch releases such as `0.1.1`.
- New capabilities before stable `1.0.0`: minor releases; TypeScript is targeted for `0.2.0`.
- While using `0.x`, explicitly call out incompatible changes and migration actions; there is no stable-interface promise merely because the code is public.
- After `1.0.0`, follow semantic versioning: patch for compatible fixes, minor for compatible features, major for incompatible interface changes.

Refer to the [Semantic Versioning specification](https://semver.org/). A `0.x` version is not automatically an npm prerelease; labels such as `-beta.1` are separate choices. Do not check GitHub's prerelease box solely because the version starts with zero.

## 2. Prepare the candidate

1. Review the intended source changes, supported platforms, public commands, and generated exports. Preserve unrelated work.
2. Update README usage and limitations. Remove promises for features not included in this release.
3. Move included changes from Unreleased into the intended version's changelog entry. Replace the draft label with the actual date only during the final publication preparation; do not claim it has shipped early.
4. For template changes, explain what existing applications must change manually. Installing a newer generator never automatically migrates their files.
5. Review package metadata, executable mode/shebang, dependencies, engine range, and the files allowlist.

For the first release, keep `0.1.0`; do not bump it simply to remove the draft status. For later releases, an authorized `npm version patch --no-git-tag-version` or `npm version minor --no-git-tag-version` updates metadata without creating a tag. Inspect its effects, including a lockfile if one exists. Version changes still need review.

## 3. Verify before release

Use Node.js 22 or later for contributor tools:

```sh
npm test
npm pack --dry-run --ignore-scripts
```

Require the GitHub CI jobs to pass on the release commit. CI checks Node 22 tests on Linux/macOS/Windows and the CLI's minimum/runtime-patch line on Linux. A workflow file existing locally is not proof those jobs passed.

Use `CLI_NODE_BINARY` to repeat local compatibility checks against another Node executable. Check the declared minimum, not only a recent patch release.

Create a package archive for verification:

```sh
npm pack --ignore-scripts
```

Inspect the archive and its manifest. Required executable/source/templates, README, license, and changelog must be included. No credentials, local instructions, learning notes, or unrelated files may be present. `npm pack` checks packaging; it does not publish.

From a separate disposable npm project, test the archive through npm's command mapping. Replace the path with the actual archive:

```sh
npm exec --yes --package=/absolute/path/axios-scaffold-kit-0.1.0.tgz -- axios-scaffold-kit --help
npm exec --yes --package=/absolute/path/axios-scaffold-kit-0.1.0.tgz -- axios-scaffold-kit init -y
```

The first `--yes` belongs to npm and permits fetching/running the CLI package. The final `-y` belongs to axios-scaffold-kit and authorizes Axios installation. They are different decisions. To test our interactive consent, omit the final `-y` and use a real terminal.

The tarball `npm exec` path was verified with npm 8.19.4 and npm 10.9.8. npm 7.10.0 bundled with Node 16.0.0 failed this local-tarball path with `Cannot read property 'spec' of undefined` before our CLI started. That is not a successful command-execution check. For that minimum runtime, the npm-installed executable mapping was verified instead. Use a separate disposable tool-host directory, not the generator repository or a real application:

```sh
# POSIX example; replace these paths with new disposable directories and the actual archive.
cd /path/to/disposable-tool-host
npm init -y
npm install /absolute/path/axios-scaffold-kit-0.1.0.tgz --no-save --ignore-scripts --package-lock=false

cd /path/to/disposable-target-project
/path/to/disposable-tool-host/node_modules/.bin/axios-scaffold-kit init -y
```

Keep the intended Node runtime on PATH for the executable's shebang. On Windows, use the corresponding `.cmd` launcher. This tests npm's installed bin mapping; it is distinct from successful `npm exec --package` verification. Normal maintainer tarball checks above use Node 22+ and do not require the old npm fallback. Do not claim the published-registry `npx` path was verified before actual publication.

Verify yes, refusal, blank input, Ctrl+C, EOF, noninteractive refusal, both consent flags, existing Axios preservation, conflict protection, and installation failure behavior. Check generated requests against a controlled local HTTP server. Real npm downloads may use the network; routine tests should not.

The first release does not need TypeScript, authentication, output selection, or a compiled build. Do not install extra tooling solely to create a release artifact.

## 4. Authorize and record the final release commit

Obtain explicit authorization for release mutations. Once the candidate is approved:

1. Enable npm account two-factor authentication and confirm the account can publish under the selected name. Never commit npm tokens or credentials.
2. Recheck name availability for the initial publication. A previously unregistered name is not reserved.
3. Deliberately remove `private: true` (or set it to boolean false), finalize release notes/date, and review the exact diff.
4. Create the release commit and push it only when authorized. Wait for its CI checks to pass.
5. Confirm `git status --short` is clean and `package.json` has the intended version. Build the final archive again from this exact committed state and repeat the package checks. Record its filename and checksum from `npm pack --json`.

Do not publish an earlier archive built before the final metadata/release commit. Keep the reviewed final archive for publication.

## 5. Publish npm, then the matching GitHub Release

These are examples for an explicitly authorized release; they are not part of ordinary feature development:

```sh
npm login
npm publish ./axios-scaffold-kit-0.1.0.tgz --access public
```

Publish the verified archive. Direct interactive publication requires the account's applicable authentication, including 2FA. Follow the current [npm publication instructions](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/). Check the registry result before announcing success. If npm reports a network error, inspect the registry before retrying: the first attempt may already have succeeded.

After confirming npm publication, create an annotated tag on the exact release commit and push that tag, when authorized:

```sh
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

On GitHub, open **Releases → Draft a new release**, select the existing `v0.1.0` tag, and paste the reviewed release notes. Check the tag points to the verified commit; do not create a tag on whatever happens to be the newest main commit.

If npm succeeded but tagging or the GitHub announcement failed, finish those remaining steps using the same released commit. Do not republish a different artifact under the same version.

## 6. Write useful release notes

Use this outline, omitting empty sections:

```text
Summary
Added
Fixed
Breaking changes
Supported platforms and known limitations
Actions required for existing generated applications
Installation / usage command
```

For the initial release, show `npx axios-scaffold-kit@0.1.0 init` and the consent flag option. For a future TypeScript release, explain the new selection/interface, tested compiler environment, and that existing JavaScript files are not converted automatically. Never describe a planned capability as shipped.

GitHub's generated notes can help collect PRs and contributors, but review them and add practical user-facing behavior and migration guidance. Keep the changelog and release announcement consistent.

## 7. Assets and post-publication checks

GitHub automatically provides **Source code (.zip)** and **Source code (.tar.gz)** for the tag. They represent the tracked repository, including tests and public docs; the npm archive contains the curated package files. These are different artifacts. No manual ZIP or compiled binary upload is required for this CLI. Attaching the npm `.tgz` is optional, not part of the first-release process.

See [GitHub's release documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases).

After publication:

```sh
npm view axios-scaffold-kit@0.1.0 version engines bin repository
npx axios-scaffold-kit@0.1.0 --help
```

Repeat generation in a fresh disposable application using the exact published version, verify the GitHub Release appears in the release list, and check the npm page's README/repository links. Record what actually passed. Then collect subsequent work under Unreleased and use a new version for the next release.

Publishing automation can be introduced later after the manual process is understood. This CI workflow never publishes npm packages or creates GitHub Releases.
