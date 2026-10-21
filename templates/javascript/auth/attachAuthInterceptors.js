import axios from "axios";

// Application choices belong in authConfig.js. This file implements how those hooks
// affect Axios requests, responses, refresh coordination, and interceptor cleanup.
const ACTIVE_CLIENTS = new WeakMap();
const CSRF_METHODS = new Set(["post", "put", "patch", "delete"]);
const REQUEST_STATE = "_axiosScaffoldAuth";
let nextConfigurationId = 0;

// Reject invalid hooks before registering anything, leaving the client unchanged on failure.
function validateOptions(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Authentication options must be an object.");
  }
  for (const name of ["getAccessToken", "refreshAccessToken", "onRefreshFailure"]) {
    if (options[name] !== undefined && typeof options[name] !== "function") {
      throw new TypeError(`${name} must be a function.`);
    }
  }
  if (options.refreshAccessToken && !options.getAccessToken) {
    throw new TypeError("refreshAccessToken requires getAccessToken.");
  }
  if (options.csrf !== undefined) {
    const csrf = options.csrf;
    if (!csrf || typeof csrf !== "object" || typeof csrf.getToken !== "function") {
      throw new TypeError("csrf requires a getToken function.");
    }
    const name = csrf.headerName ?? "X-XSRF-TOKEN";
    if (typeof name !== "string" || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)
      || name.toLowerCase() === "authorization") {
      throw new TypeError("csrf.headerName must be a valid header name other than Authorization.");
    }
  }
}

// Resolve browser-relative or absolute API URLs and reject non-HTTP(S) protocols.
function resolveHttpUrl(value) {
  // Browser-relative URLs are resolved at configuration/request time, never at import time.
  const pageUrl = typeof window === "undefined" ? undefined : window.location?.href;
  const url = new URL(value, pageUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Authentication requires an HTTP(S) API base URL.");
  }
  return url;
}

// Allow missing access/CSRF tokens, require refresh results, and never include secrets in errors.
function readToken(value, name, required = false) {
  if (!required && (value === null || value === undefined || value === "")) {
    return null;
  }
  if (typeof value !== "string" || !value.trim() || /[\r\n]/.test(value)) {
    throw new TypeError(`${name} must return a nonempty token string${required ? "." : " or null."}`);
  }
  return value;
}

/**
 * Attach optional request/response interceptors using the hooks supplied by authConfig.js.
 * No storage or endpoint is assumed; edit authConfig.js for normal backend customization.
 * refreshAccessToken must persist the new access token AND return it.
 * @param {import("axios").AxiosInstance} client
 * @param {{getAccessToken?: () => (string|null|Promise<string|null>),
 * refreshAccessToken?: () => Promise<string>, onRefreshFailure?: (error: unknown) => unknown,
 * csrf?: {getToken: (config: object) => (string|null|Promise<string|null>), headerName?: string}} options
 * @returns {() => void} Remove these interceptors before reconfiguring this client.
 */
export function attachAuthInterceptors(client, options = {}) {
  validateOptions(options);
  if (ACTIVE_CLIENTS.has(client)) {
    throw new Error("Authentication is already configured; call cleanup before reconfiguring.");
  }
  if (!options.getAccessToken && !options.csrf) {
    return () => {};
  }
  if (!axios.AxiosHeaders?.from) {
    throw new Error("Optional authentication requires AxiosHeaders support. Upgrade Axios explicitly or customize this file; existing dependencies are never upgraded by the generator.");
  }

  let apiOrigin;
  try {
    apiOrigin = resolveHttpUrl(client.defaults.baseURL).origin;
  } catch (error) {
    throw new Error("Set a resolvable HTTP(S) client.defaults.baseURL before attachAuthInterceptors.", { cause: error });
  }

  const { getAccessToken, refreshAccessToken, onRefreshFailure } = options;
  const csrf = options.csrf ? { ...options.csrf } : null;
  const csrfHeader = csrf?.headerName ?? "X-XSRF-TOKEN";
  const configurationId = ++nextConfigurationId;
  let active = true;
  // Each successful refresh advances the generation so late failures can reuse its token.
  let generation = 0;
  let latestToken = null;
  let refreshPromise = null;

  // Only requests resolving to the captured API origin receive generated credentials/recovery.
  function isApiRequest(config) {
    try {
      return resolveHttpUrl(client.getUri(config)).origin === apiOrigin;
    } catch {
      // Let Axios report invalid request URLs, without adding generated credentials.
      return false;
    }
  }

  // Request interceptor: preserve caller headers, honor bypass flags, and add enabled tokens.
  // Returning config lets Axios send it; a hook failure rejects before dispatch.
  async function prepareRequest(config) {
    if (!active) return config;
    config.headers = axios.AxiosHeaders.from(config.headers);
    const headers = config.headers;
    const previous = config[REQUEST_STATE];
    const owned = previous?.configurationId === configurationId;
    const retry = owned && previous.retried;
    // Axios merges/clones request config on retries, so metadata uses plain values.
    const state = retry ? previous : { configurationId, retried: false };
    config[REQUEST_STATE] = state;

    if (owned) {
      if (previous.authorization && headers.get("Authorization") === previous.authorization) {
        headers.delete("Authorization");
      }
      if (previous.csrfToken && headers.get(csrfHeader) === previous.csrfToken) {
        headers.delete(csrfHeader);
      }
    }
    state.authorization = null;
    state.csrfToken = null;
    state.canRefresh = false;
    if (!isApiRequest(config)) return config;

    const callerAuthorization = headers.has("Authorization") || Boolean(config.auth);
    if (getAccessToken && !config.skipAuth && !callerAuthorization) {
      const requestGeneration = generation;
      let token = readToken(await getAccessToken(), "getAccessToken");
      if (!active) return config;
      // A refresh may have completed while an asynchronous token lookup was pending.
      if (requestGeneration !== generation || retry) token = latestToken ?? token;
      state.generation = generation;
      state.canRefresh = true;
      if (token) {
        state.authorization = `Bearer ${token}`;
        headers.set("Authorization", state.authorization);
      }
    }
    if (csrf && CSRF_METHODS.has(config.method?.toLowerCase())) {
      // Hook mode owns CSRF: Axios's browser cookie reader must not replace its header.
      config.xsrfCookieName = null;
    }
    if (csrf && !config.skipCsrf && CSRF_METHODS.has(config.method?.toLowerCase())
      && !headers.has(csrfHeader)) {
      const token = readToken(await csrf.getToken(config), "csrf.getToken");
      if (active && token) {
        state.csrfToken = token;
        headers.set(csrfHeader, token);
      }
    }
    return config;
  }

  // Start one refresh or reuse the pending operation for every waiting request.
  // The application callback persists the token; this module keeps a result for retries.
  function refreshOnce() {
    if (!refreshPromise) {
      refreshPromise = Promise.resolve().then(refreshAccessToken).then((value) => {
        latestToken = readToken(value, "refreshAccessToken", true);
        generation += 1;
        return latestToken;
      }).catch((error) => {
        // Notifications must not replace or delay rejection of the refresh error.
        if (active && onRefreshFailure) {
          Promise.resolve().then(() => onRefreshFailure(error)).catch(() => {});
        }
        throw error;
      }).finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  }

  // Give one caller a cancellable wait without cancelling the shared refresh operation.
  function waitForRefresh(promise, config) {
    // One caller's cancellation must not abort refresh for other waiting requests.
    return new Promise((resolve, reject) => {
      const signal = config.signal;
      const cancelToken = config.cancelToken;
      // Remove this waiter's temporary cancellation listeners after any outcome.
      function cleanup() {
        signal?.removeEventListener("abort", cancel);
        cancelToken?.unsubscribe(cancel);
      }
      // Reject just this caller using Axios's cancellation error.
      function cancel() {
        cleanup();
        reject(new axios.CanceledError("Request cancelled while waiting for token refresh.", config));
      }
      signal?.addEventListener("abort", cancel, { once: true });
      cancelToken?.subscribe(cancel);
      if (signal?.aborted || cancelToken?.reason) cancel();
      promise.then((token) => {
        cleanup();
        resolve(token);
      }, (error) => {
        cleanup();
        reject(error);
      });
    });
  }

  // Response error interceptor: refresh only eligible 401s and replay each request at most once.
  // Other errors propagate to the application without changing its session or navigation.
  async function recoverResponse(error) {
    const config = error.config;
    const state = config?.[REQUEST_STATE];
    if (!active || axios.isCancel(error) || error.response?.status !== 401
      || !refreshAccessToken || state?.configurationId !== configurationId
      || !state.canRefresh || state.retried || config.skipAuth || !isApiRequest(config)) {
      throw error;
    }
    if (config.signal?.aborted) throw new axios.CanceledError("Request cancelled.", config);
    config.cancelToken?.throwIfRequested();
    // Mark before awaiting refresh so recovery cannot create an indefinite retry loop.
    state.retried = true;
    // An older request may return 401 after another request already refreshed.
    if (refreshPromise || state.generation === generation) {
      await waitForRefresh(refreshPromise ?? refreshOnce(), config);
    }
    if (!active) throw error;
    return client(config);
  }

  const requestId = client.interceptors.request.use(prepareRequest);
  // Successful responses pass through intact, preserving status, headers, and data.
  const responseId = client.interceptors.response.use((response) => response, recoverResponse);
  // Returned lifecycle cleanup: remove only our interceptors and prevent pending recovery replay.
  // Calling it repeatedly is safe; it does not abort application-owned backend refresh calls.
  function cleanup() {
    if (!active) return;
    active = false;
    client.interceptors.request.eject(requestId);
    client.interceptors.response.eject(responseId);
    ACTIVE_CLIENTS.delete(client);
  }
  ACTIVE_CLIENTS.set(client, cleanup);
  return cleanup;
}
