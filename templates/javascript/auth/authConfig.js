// Uncomment this import only when enabling the refresh example below.
// import axios from "axios";

/**
 * Customize authentication here; attachAuthInterceptors.js owns the interceptor mechanics.
 * All examples are commented out, so the generated client starts without auth.
 * @param {import("axios").AxiosInstance} apiClient The client already created by apiClient.js.
 */
export function createAuthConfig(apiClient) {
  // BROWSER STORAGE EXAMPLE: uncomment when using any storage-based hooks below.
  // Change sessionStorage to localStorage only if that matches your storage policy.
  // Login, refresh, and logout must use the same storage and token key.
  // Or replace the hooks with calls to your existing application token store.
  // const getStorage = () => sessionStorage;

  // REFRESH EXAMPLE: also uncomment the axios import and refreshAccessToken below.
  // A separate client avoids recursively refreshing the authenticated client.
  // Configure this client's cookies/CSRF separately if your backend requires them.
  // const refreshClient = axios.create({
  //   baseURL: apiClient.defaults.baseURL,
  //   timeout: apiClient.defaults.timeout,
  // });

  return {
    // BEARER: enable this property to attach the current access token when present.
    // getAccessToken: () => getStorage().getItem("accessToken"),

    // REFRESH: requires getAccessToken. Replace endpoint, body, and response parsing.
    // Add your own logic here; persist the new token AND return it.
    // refreshAccessToken: async () => {
    //   const response = await refreshClient.post("/your-refresh-endpoint");
    //   const token = response.data.accessToken;
    //   if (typeof token !== "string" || !token.trim()) {
    //     throw new Error("Refresh did not return an access token.");
    //   }
    //   getStorage().setItem("accessToken", token);
    //   return token;
    // },

    // FAILURE: optionally notify your application; no automatic redirect is assumed.
    // onRefreshFailure: () => {
    //   getStorage().removeItem("accessToken");
    // },

    // CSRF: independent of bearer auth. Replace storage lookup with your backend's
    // cookie/token-acquisition contract. Your application must supply csrfToken.
    // csrf: {
    //   getToken: () => getStorage().getItem("csrfToken"),
    //   headerName: "X-XSRF-TOKEN",
    // },
  };
}

// Enable only what you need. On individual requests, skipAuth bypasses generated
// bearer/refresh; skipCsrf separately bypasses generated CSRF. Neither removes cookies.
// Set the API base URL before setup. For runtime changes, clean up and reconfigure;
// do not register authentication twice. See the README for complete copyable recipes.
