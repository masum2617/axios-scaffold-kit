# Maintainer release guide

This is the manual first-release walkthrough for axios-scaffold-kit. Preparation is not publication: commits, pushes, tags, account changes, removing the npm publication block, GitHub Release creation, and npm publication require the maintainer's explicit authorization. The `0.1.0` manifest no longer has `private: true`: the maintainer removed that block during release preparation. This does not publish the package or authorize publication.

## What GitHub and npm each do

| Item | First-release value | Purpose |
| --- | --- | --- |
| GitHub repository | masum2617/axios-scaffold-kit | Source, issues, pull requests, CI, and documentation. |
| Git tag | v0.1.0 | Names the exact reviewed release commit. |
| GitHub Release | v0.1.0 — Initial JavaScript release | Release-list entry with notes and automatic source archives. |
| npm package | axios-scaffold-kit@0.1.0 | Installable generator used by npx/npm. |

A GitHub Release does **not** publish to npm. This guide follows the requested GitHub-first order. If GitHub is public before npm, mark its notes **Source release available; npm publication pending** until npm checks succeed. Do not announce working registry commands before then.

Keep tag, package version, notes, and source commit aligned. A published version/tag is not a place to replace code silently; fix it with another version.

## Step 1 — Check the accounts and package name

Use an npm account you control with two-factor authentication configured for the manual release. Do this yourself in the browser; never put credentials or recovery codes in the repository or chat. Consult the current [npm publishing requirements](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/) and [2FA guidance](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/).

From the generator repository, using Node 22+ for release/contributor tools:

```sh
node --version
npm --version
npm view axios-scaffold-kit name version --registry=https://registry.npmjs.org
```

A genuine registry E404 indicates the name is not currently registered; it does not reserve it or guarantee npm will accept publication. A network/authentication failure is not an availability check. If a package exists, confirm that your account owns it before continuing. Resolve name conflicts before tagging anything.

Log in when you are ready to publish:

```sh
npm login --registry=https://registry.npmjs.org
npm whoami --registry=https://registry.npmjs.org
```

Follow npm's interactive browser/2FA prompts yourself. No automation token or GitHub secret is required for this manual process. Public unscoped publication does not require a paid private-package subscription.

## Step 2 — Verify the candidate locally

Run commands from the **generator repository**, not the application used to test its output:

```sh
cd /path/to/axios-scaffold-kit
git status --short --branch
node scripts/prepare-auth-fixture.js
```

Copy the temporary fixture path printed by the preparation script:

```sh
export AXIOS_TEST_DIRECTORY="/absolute/path/printed/by/the/script"
npm test
npm pack --dry-run --ignore-scripts
```

The complete candidate currently has 84 checks. A passing base suite with authentication skipped is not a full release check. Preparation installs Axios only in a disposable project; tests use controlled adapters/local HTTP rather than a live backend.

Keep the runner on Node 22+ and use CLI_NODE_BINARY for the minimum consumer runtime when available. Verify the declared Node 16.0.0 minimum, not only the latest patch. Record exact Node/Axios versions and platforms.

For browser verification:

```sh
node scripts/serve-auth-browser-fixture.js
```

Open its localhost URL, require PASS, then stop the server with Ctrl+C. Review default disabled behavior, automatic configuration, the documented recipes, public requests, refresh/cancellation, CSRF, fixed-origin filtering, and cleanup. Local browser proof does not establish all browsers/platforms.

Review README, authentication examples, CHANGELOG, [release notes](releases/0.1.0.md), package metadata, executable shebang/mode, and the package files allowlist. Preserve unrelated work. Keep private local agent/learning documents ignored and absent from the npm archive. Inspect git's staged changes before any commit; do not force-add ignored files.

## Step 3 — Finalize and push the release commit, after authorization

The first release stays **0.1.0**. It includes JavaScript, fixed src/api output, installation consent, and optional bearer/refresh/CSRF hooks. TypeScript is not a release prerequisite.

Only after the release candidate is approved:

1. Remove the README's unpublished-candidate notice or replace it with accurate release-status links. Keep any GitHub-first npm-pending status in the release announcement until verification succeeds.
2. Finalize the changelog entry for the source release; leave its status as prepared/publication pending until the release action succeeds. Record the actual source release date when creating the GitHub Release, and record npm status separately. Use actual CI/verification evidence in the release notes.
3. Check the manifest publication block. It is already removed for `0.1.0`; do not change it again. For a future unpublished package that still has the block, remove it only after authorization:

   ```sh
   npm pkg delete private
   ```

4. Review all intended files with git status/diff. Stage only reviewed release content. If every listed change belongs to the approved release, the following is one manual path:

   ```sh
   git add .
   git diff --cached --stat
   git diff --cached
   git commit -m "Release v0.1.0"
   git push origin main
   ```

   Do not execute these as part of ordinary documentation preparation. The current checkout may already be ahead of origin; inspect every commit being pushed. The ignored learning/agent files must remain untracked.

5. Open the repository's Actions tab and wait for **all** CI jobs on that exact commit. Linux/macOS/Windows Node 22 jobs and Linux minimum/latest-patch CLI jobs must pass, including real Axios integration tests. Configuration existing locally is not proof of remote success.

If CI fails, fix it, create a reviewed replacement release commit, and rerun checks **before** creating v0.1.0. Do not attach a release tag to a failing commit.

## Step 4 — Build and verify the exact package

After CI passes, confirm a clean tracked working tree and record the commit:

```sh
git status --short
git rev-parse HEAD
npm pack --ignore-scripts --json
```

Keep the printed archive (`axios-scaffold-kit-0.1.0.tgz`) and its integrity/shasum. Confirm its manifest is version 0.1.0 and no longer has private: true. The package includes CLI sources/templates, README, license, changelog, and the authentication guide. The local guides, learning notes, tests, release notes, and maintainer scripts are not package runtime files.

Test npm's command mapping from a **fresh disposable target project** with a package.json:

```sh
npm exec --yes --package=/absolute/path/axios-scaffold-kit-0.1.0.tgz -- axios-scaffold-kit --help
npm exec --yes --package=/absolute/path/axios-scaffold-kit-0.1.0.tgz -- axios-scaffold-kit init -y
```

The outer --yes belongs to npm's package download; the inner -y authorizes Axios installation. To check consent, omit inner -y in a real terminal. Use a different fresh target for each generation scenario; existing destinations must fail.

Verify the four files, preserved dependency/lockfile paths, installation failure, cancellation/refusal, nested conflicts, and generated requests against a controlled local server. Never test generation in a real user application accidentally. Do not modify source after packing/tagging without rebuilding and re-verifying the candidate.

### Old npm minimum-runtime fallback

Local-tarball npm exec was verified with npm 8.19.4 and 10.9.8. npm 7.10.0 on Node 16.0.0 failed before starting the CLI with `Cannot read property 'spec' of undefined`. The alternative npm-installed executable mapping was verified:

```sh
# Two separate disposable directories, each with its own package.json.
cd /path/to/disposable-tool-host
npm install /absolute/path/axios-scaffold-kit-0.1.0.tgz --no-save --ignore-scripts --package-lock=false

cd /path/to/disposable-target-project
/path/to/disposable-tool-host/node_modules/.bin/axios-scaffold-kit init -y
```

Keep the intended Node on PATH for the shebang; Windows uses the corresponding .cmd launcher. Do not describe installed-bin verification as successful npm exec or published-registry npx proof.

## Step 5 — Create the GitHub tag and Release

After the exact commit/archive are verified and tagging is authorized:

```sh
git tag -a v0.1.0 -m "Release v0.1.0" HEAD
git push origin v0.1.0
```

Confirm HEAD is still the recorded release commit before running that command. Do not move an existing published tag. On GitHub:

1. Open **Releases → Draft a new release**.
2. Select the existing **v0.1.0** tag; verify its target commit.
3. Title it **v0.1.0 — Initial JavaScript release**.
4. Paste the reviewed contents of docs/releases/0.1.0.md, updating its prepared status to the actual source-release status and recording the final commit/check evidence.
5. Because npm follows next, clearly state **Source release available; npm publication pending**. Do not claim npm commands have been verified yet.
6. A 0.x version is not automatically a prerelease; do not select prerelease solely because it starts with zero.
7. Publish the GitHub Release only when authorized. If you prefer to wait until npm succeeds, **Save draft** instead; finalize it afterward.

GitHub supplies source ZIP/tar archives for the tag. No manual ZIP, compiled binary, or node_modules upload is needed. Those source archives differ from npm's curated package archive. For this CLI, no manually uploaded assets are required. See [GitHub's release instructions](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository).

## Step 6 — Publish the verified archive to npm

Confirm authorization, the logged-in npm account, name availability/ownership, and the exact reviewed archive. Publish that archive rather than rebuilding from an unrelated working tree:

```sh
npm whoami --registry=https://registry.npmjs.org
npm publish ./axios-scaffold-kit-0.1.0.tgz --access public --registry=https://registry.npmjs.org
```

Complete the required interactive authentication/2FA prompts yourself. Current requirements are in [npm's direct publishing documentation](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/). The registry publication is separate from GitHub.

If publication reports an ambiguous network error, check the registry before retrying: the first attempt may have succeeded. If a source/tagged release needs code changes before npm succeeds, do not move its public tag; prepare another version with clear notes. Never republish different contents under a version already registered.

## Step 7 — Verify the public installation and finish the announcement

```sh
npm view axios-scaffold-kit@0.1.0 version engines bin repository dist.integrity --registry=https://registry.npmjs.org
npx --yes axios-scaffold-kit@0.1.0 --help
```

Compare the registry integrity with the saved archive metadata. In another fresh disposable application, run the exact published init command, verify all four files and request behavior, and check the npm README/repository/documentation links.

Only after npm succeeds and these checks pass, remove the npm-pending sentence from GitHub release notes (or publish the saved GitHub draft) and announce both links. Check that the Release appears in the release list. Update any remaining source status text in a later reviewed documentation commit without moving the release tag.

The published-registry npx command cannot be claimed tested during local preparation. Publishing does not automatically update previously generated applications.

## Patch releases after 0.1.0

For `0.1.1`, keep the same sequence: verify changes → update the version without a tag → finalize notes → commit/push → require green CI → pack/test the clean commit → create the matching tag/GitHub Release → publish the verified archive → check registry integrity and command execution.

- The maintainer has updated package.json to `0.1.1` using `npm version patch --no-git-tag-version`; do not increment it again for this patch.
- Review [the 0.1.1 notes](releases/0.1.1.md) and CHANGELOG. Keep pending status until each actual release action succeeds.
- Use `axios-scaffold-kit-0.1.1.tgz`, tag `v0.1.1`, and a matching GitHub Release. Do not replace the 0.1.0 tag or archive.
- The current suite has 87 checks. The 84-check count earlier in this guide records initial-release verification.
- If publishing creates a staged entry rather than a live version, inspect it using `npm stage list axios-scaffold-kit` or npm's Staged Packages tab, then approve the intended version through the authenticated 2FA flow. Do not upload again solely because the general listing still shows a temporary placeholder; first inspect version visibility and staging status.
- Verify `0.1.1` from outside this source repository using a fresh disposable project/cache. Update the GitHub Release's pending status only after that version is available and checked.

## Future versions and maintenance

- Record future work under Unreleased. Bug fixes normally become 0.1.1; TypeScript is targeted for 0.2.0 with clear compatibility/migration notes.
- While pre-1.0, explicitly describe incompatible changes. After 1.0, use standard semantic versioning: compatible fix = patch, compatible feature = minor, incompatible contract = major. See [SemVer](https://semver.org/).
- Each release needs matching npm version, v-prefixed tag, GitHub Release, changelog, relevant tests, and manual-adoption notes for generated-code changes.
- Use release-note sections for additions, fixes, breaking changes, limitations, and actions required by existing users. Omit empty sections rather than inventing changes.
- Maintainers review contributions and control merges/releases. Public contributors do not receive npm publishing rights automatically.
- New generator versions affect future output only. Maintain Axios in consuming applications through their normal dependency workflow.

Automation can be added later. The current GitHub workflow has read-only permissions and does not publish npm packages or create releases.
