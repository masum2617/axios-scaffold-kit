import axios from "axios";
import { createAuthConfig } from "./auth/authConfig.js";
import { attachAuthInterceptors } from "./auth/attachAuthInterceptors.js";

export const apiClient = axios.create({
  // Replace this example URL with your API's base URL or configuration value.
  baseURL: "https://api.example.com",
  // The generator replaces this placeholder with the shared timeout default.
  timeout: __DEFAULT_TIMEOUT_MS__,
});

// authConfig.js returns empty options by default: no auth interceptors are enabled.
// Set the base URL above before enabling its examples. Keep this cleanup for reconfiguration.
export const cleanupAuth = attachAuthInterceptors(apiClient, createAuthConfig(apiClient));
