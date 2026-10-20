# Changelog

User-visible changes are recorded here. Released entries use the npm version, a matching `v`-prefixed Git tag, and the actual publication date. Draft entries are not release announcements.

## Unreleased

Future changes will be collected here before a release is prepared. TypeScript support is targeted for a later `0.2.0`; authentication and output-directory selection are also future work, not part of `0.1.0`.

## 0.1.0 — draft, not published

### Added

- JavaScript API starter generation through `axios-scaffold-kit init` into `src/api`.
- Shared Axios client and GET, POST, PUT, PATCH, and DELETE examples.
- Query parameters, request bodies, optional request configuration, and full client responses; example API functions return `response.data`.
- Missing-Axios installation after an interactive yes/no confirmation, or explicit `-y`/`--yes` authorization.
- Preservation of existing direct Axios declarations and checks for output conflicts before dependency installation.
- Node.js 16+ CLI compatibility, with Node.js 22+ contributor tests.
- Contributor guidance and a read-only CI workflow for testing and package inspection.

### Limitations

- JavaScript ES modules only; fixed output location; no authentication helpers.
- Automatic installation supports standalone npm projects, not workspace or Yarn/pnpm installation workflows.
- npm can modify dependency metadata, lockfiles, and node_modules after authorization. Failed operations are reported without promising rollback.
- Platforms and runtime versions listed as configured in CI are not verified until their jobs pass. See the README for actual local verification.

### Existing users

This is the initial-release draft. Future generator updates will not rewrite files already generated in an application. Relevant fixes will include manual update guidance.
