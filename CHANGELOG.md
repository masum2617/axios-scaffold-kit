# Changelog

User-visible changes are recorded here. Released entries use the npm version, a matching `v`-prefixed Git tag, and the actual publication date. Draft entries are not release announcements.

## Unreleased

Future changes will be collected here before a release is prepared. TypeScript support is targeted for a later `0.2.0`; output-directory selection remains future work.

## 0.1.0 — draft, not published

### Added

- JavaScript API starter generation through `axios-scaffold-kit init` into `src/api`.
- Shared Axios client and GET, POST, PUT, PATCH, and DELETE examples.
- Query parameters, request bodies, optional request configuration, and full client responses; example API functions return `response.data`.
- Missing-Axios installation after an interactive yes/no confirmation, or explicit `-y`/`--yes` authorization.
- Preservation of existing direct Axios declarations and checks for output conflicts before dependency installation.
- Node.js 16+ CLI compatibility, with Node.js 22+ contributor tests.
- Editable `auth/authConfig.js` with commented bearer, refresh, failure, and CSRF recipes; automatic shared-client wiring stays disabled with default empty options.
- Optional `attachAuthInterceptors` interceptors for bearer tokens, public-request bypass, coordinated refresh with bounded retries, cancellation, and independent CSRF hooks.
- Fixed-origin credential filtering, caller-header preservation, and interceptor cleanup/reconfiguration.
- Disposable real-Axios integration tests and a local browser fixture.
- Contributor guidance and a read-only CI workflow for testing and package inspection.

### Changed

- Renamed the unpublished interceptor file/export from `configureAuth.js` / `configureAuth` to `attachAuthInterceptors.js` / `attachAuthInterceptors` to distinguish it from editable `authConfig.js`. Added comments explaining each function; authentication behavior is unchanged. Earlier local copies require manual import/export updates.

### Limitations

- JavaScript ES modules only; fixed output location.
- Authentication requires developer-supplied token access, refresh persistence, and backend-specific CSRF handling. No token storage, login endpoints, redirects, cross-tab coordination, or automatic CSRF recovery is generated.
- Existing Axios versions are not upgraded; optional authentication uses the public AxiosHeaders API (verified with Axios 1.20.0).
- Automatic installation supports standalone npm projects, not workspace or Yarn/pnpm installation workflows.
- npm can modify dependency metadata, lockfiles, and node_modules after authorization. Failed operations are reported without promising rollback.
- Platforms and runtime versions listed as configured in CI are not verified until their jobs pass. See the README for actual local verification.

### Existing users

This is the initial-release draft. Future generator updates will not rewrite files already generated in an application. Relevant fixes will include manual update guidance.

Before adopting this candidate from earlier local output, compare the four templates. Manually add `auth/authConfig.js` and update the shared client wiring; retain `auth/attachAuthInterceptors.js` or add it if missing. The CLI refuses to overwrite existing starter files; enabling authentication is explicit.
