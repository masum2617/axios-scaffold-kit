# Optional authentication

Edit the generated `src/api/auth/authConfig.js` to connect your application's authentication. Both interceptors remain together in `attachAuthInterceptors.js`; you normally do not need to edit that implementation.

The default `createAuthConfig(apiClient)` returns empty options. Importing `apiClient` does not read browser storage, contact a backend, or enable authentication interceptors. Ordinary requests work immediately. The generated client connects configuration once:

```js
export const cleanupAuth = attachAuthInterceptors(apiClient, createAuthConfig(apiClient));
```

Set your base URL in `apiClient.js` before enabling configuration. The factory receives the already-created client, so it must not import `apiClient.js` back into itself. The examples below are complete replacements for `authConfig.js`, not additional setup calls. Enable only the features your backend supports.

The helper uses Axios's public `AxiosHeaders` API; Axios 1.20.0 was verified. Older releases lacking that API fail clearly when enabling hooks. Existing Axios declarations are never upgraded automatically.

## Bearer tokens and storage

<!-- recipe:bearer -->
```js
// Browser-only example. Replace storage access with your existing token store if needed.
export function createAuthConfig(apiClient) {
  const getStorage = () => sessionStorage;
  return {
    getAccessToken: () => getStorage().getItem("accessToken"),
  };
}
```

Your login code must save the token under the same key:

```js
sessionStorage.setItem("accessToken", loginResponse.data.accessToken);
```

Logout and refresh must use that same storage. To illustrate integration with an application that chooses local storage, replace `() => sessionStorage` with `() => localStorage` and update login/logout consistently. Both are browser APIs accessible to JavaScript; these are customization examples, not a recommended token-storage policy. For server rendering or Node applications, supply an appropriate application-owned store instead.

`getAccessToken()` may return a token or `null`, synchronously or through a promise. Missing tokens add no header; invalid values and hook errors reject before dispatch. For an existing store, replace the callback with your imported store function. No token-store implementation is generated.

## Bearer authentication with custom refresh

<!-- recipe:refresh -->
```js
import axios from "axios";

export function createAuthConfig(apiClient) {
  const getStorage = () => sessionStorage;
  const refreshClient = axios.create({
    baseURL: apiClient.defaults.baseURL,
    timeout: apiClient.defaults.timeout,
  });

  return {
    getAccessToken: () => getStorage().getItem("accessToken"),
    refreshAccessToken: async () => {
      // Replace endpoint, request body, and response parsing for YOUR backend.
      const response = await refreshClient.post("/your-refresh-endpoint");
      const token = response.data.accessToken;
      if (typeof token !== "string" || !token.trim()) {
        throw new Error("Refresh did not return an access token.");
      }
      // Add application-specific logic here. Persist the token AND return it.
      getStorage().setItem("accessToken", token);
      return token;
    },
    onRefreshFailure: () => {
      getStorage().removeItem("accessToken");
      // Notify your application here; no automatic redirect is assumed.
    },
  };
}
```

The separate refresh client avoids recursively triggering authenticated refresh. Its endpoint, body, response shape, cookies, CSRF, timeout, and storage policy belong to your application. Cookie-based refresh may require `withCredentials: true` on that client plus compatible backend CORS/cookie settings. If CSRF is required on refresh, configure it on the separate client too; it does not inherit the shared client's interceptors.

Only an eligible rejected `401` starts refresh. Axios `validateStatus` still determines rejection; accepting `401` as success bypasses this recovery path.

- Concurrent failures share one refresh promise per client. Older delayed failures reuse the latest completed generation or wait for a newer refresh already in progress.
- Each original request retries at most once; retry failure rejects normally.
- Refresh must persist and return the new token. Returning it alone leaves later requests reading stale application state.
- Refresh failure or an invalid result rejects waiting requests. `onRefreshFailure` is notified once per failed refresh; notification errors cannot replace or delay the refresh error.
- Network errors, `403`, public requests, cancelled requests, and caller-managed Authorization do not start refresh.
- Cancelling a waiter does not abort refresh needed by other requests. The refresh hook owns its finite timeout.

There are no proactive timers, cross-tab coordination, generated token storage, redirects, or automatic CSRF recovery. Backend-specific integration remains editable in your configuration file.

## Independent CSRF configuration

<!-- recipe:csrf -->
```js
// Browser-only example: your application must obtain and save this value first.
export function createAuthConfig(apiClient) {
  const getStorage = () => sessionStorage;
  return {
    csrf: {
      getToken: () => getStorage().getItem("csrfToken"),
      headerName: "X-XSRF-TOKEN",
    },
  };
}
```

Replace storage lookup with your backend's cookie or token-acquisition contract. `getToken(config)` may return a token or `null`, synchronously or asynchronously. The header name defaults to `X-XSRF-TOKEN`.

To combine CSRF with bearer/refresh, add the `csrf` property from this example to the same returned options object. Do not call attachAuthInterceptors a second time. CSRF works independently; it does not require bearer authentication.

The hook runs on POST, PUT, PATCH, and DELETE, including eligible retries. Caller-supplied CSRF headers are preserved. Missing tokens add no generated header; hook errors reject the request. In hook mode, API write requests disable Axios's automatic cookie reader (`xsrfCookieName: null`) so it cannot replace your callback/explicit header. This also applies to skipCsrf write requests. Native Axios behavior for reads or foreign origins is otherwise unchanged.

The starter does not obtain CSRF tokens automatically or retry `403`, which can also mean permission denied. An HttpOnly cookie cannot be read by JavaScript; use your backend's documented mechanism for obtaining a JavaScript-visible CSRF token.

## Public requests and cookie transport

```js
await apiClient.post("/your-login-endpoint", credentials, { skipAuth: true });
await exampleApi.getAll({}, { skipAuth: true });
await apiClient.post("/without-generated-csrf", body, { skipCsrf: true });
await apiClient.post("/plain", body, { skipAuth: true, skipCsrf: true });
```

These snippets assume your application imports the generated apiClient/exampleApi and supplies its own body/credentials. `skipAuth` bypasses generated bearer attachment and refresh; `skipCsrf` separately bypasses generated CSRF. Neither flag removes explicit caller headers, suppresses browser cookies, or changes backend authorization. Explicit Authorization headers and Axios Basic `auth` remain caller-managed, including their recovery.

Cross-origin cookie transport is a separate Axios choice. Add `withCredentials: true` to the shared client's creation options if your backend needs it. Configure the separate refresh client's credentials independently. Your backend must provide compatible CORS/cookie rules.

## Cleanup and runtime reconfiguration

The generated client exports `cleanupAuth`, which removes only its configured interceptors. It is safe to call repeatedly. Its default is a no-op because empty options installed nothing. After enabling examples, a restart/reload picks up your edited configuration.

For a runtime origin/configuration change:

```js
import { apiClient, cleanupAuth } from "./api/apiClient.js";
import { createAuthConfig } from "./api/auth/authConfig.js";
import { attachAuthInterceptors } from "./api/auth/attachAuthInterceptors.js";

cleanupAuth();
apiClient.defaults.baseURL = "https://your-other-api.example.com";
const cleanupNewAuth = attachAuthInterceptors(apiClient, createAuthConfig(apiClient));
// Keep cleanupNewAuth for the next reconfiguration; the original cleanup is not updated.
```

Origin is captured during setup. Node applications need an absolute HTTP(S) base URL; browser-relative URLs resolve against the page location. Reconfigure after changing origin. Cleanup prevents pending recovery from replaying but does not abort already-dispatched requests or your refresh function; application logout must guard against late token persistence.

Generated credential headers and refresh apply only to the configured API origin, including per-request URL/baseURL overrides. This is not a network firewall: caller headers, browser cookies, native Axios settings, redirects, custom adapters, and other interceptors remain application responsibilities. Use trusted URLs and avoid cross-origin redirects carrying credentials. Register URL-rewriting interceptors so they execute before these origin checks, or use another client.

Retries require replayable bodies. Consumed streams are not made replayable. The backend must reject unauthorized operations before applying changes; use application-level idempotency when required.

## Advanced manual setup

The existing `attachAuthInterceptors(client, options)` interface remains available. If your application already supplies its own setup, leave the generated authConfig factory empty and make one manual call before application requests. Alternatively, clean up generated setup before replacing it. Do not enable the generated configuration and also register another active setup on the same client: duplicate registration throws.

You may edit attachAuthInterceptors.js when changing interceptor mechanics. Normal storage, backend refresh, CSRF acquisition, and failure customization belong in authConfig.js.

## Existing generated projects

The CLI refuses to overwrite any existing starter file. Earlier local output is updated manually: add auth/authConfig.js, review the updated apiClient wiring, and keep the existing attachAuthInterceptors implementation. No generator update automatically migrates application files. Keep tokens and private backend information out of public reports.

### Naming change for earlier local copies

The unpublished starter previously named the interceptor file `configureAuth.js` and its export `configureAuth`. These are now `attachAuthInterceptors.js` and `attachAuthInterceptors`. For an earlier local project, rename the file and update its export, imports, and calls together. The configuration factory stays `authConfig.js` / `createAuthConfig`. No compatibility alias or automatic rewrite is generated; ordinary CLI conflict protection still applies. Authentication behavior is unchanged.

## Interceptor function reference

Normal backend customization belongs in authConfig.js. These functions live together in attachAuthInterceptors.js and implement the mechanics:

| Function | Brief purpose |
| --- | --- |
| validateOptions | Validate enabled callbacks and CSRF settings before registering handlers. |
| resolveHttpUrl | Resolve HTTP(S) API URLs, including browser-relative URLs. |
| readToken | Accept optional missing tokens and reject invalid values without printing secrets. |
| attachAuthInterceptors | Attach enabled hooks to one client and return its cleanup function. |
| isApiRequest | Check the request against the configured API origin before adding generated credentials or refreshing. |
| prepareRequest | Request interceptor: preserve caller headers, update generated token headers, and honor bypass flags. |
| refreshOnce | Share one pending refresh and record its successful token generation. |
| waitForRefresh | Let each waiting request be cancelled independently of the shared refresh. |
| cleanup inside waitForRefresh | Remove temporary cancellation listeners for that waiter. |
| cancel inside waitForRefresh | Reject only that waiting request with an Axios cancellation error. |
| recoverResponse | Recover eligible 401 failures and retry each original request at most once. |
| returned cleanup | Remove only this setup's handlers and prevent old pending recovery from replaying. |

Successful responses pass through unchanged. Comments in the generated implementation explain why generation tracking, caller-header provenance, retry bounds, and cancellation cleanup are retained.
