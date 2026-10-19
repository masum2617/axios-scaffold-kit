import axios from "axios";

export const apiClient = axios.create({
  // Replace this example URL with your API's base URL or configuration value.
  baseURL: "https://api.example.com",
  // The generator replaces this placeholder with the shared timeout default.
  timeout: __DEFAULT_TIMEOUT_MS__,
});
