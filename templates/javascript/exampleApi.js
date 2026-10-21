import { apiClient } from "./apiClient.js";

// Replace these example endpoints with your application's API contract.
const API_PREFIX = "/examples";

export const exampleApi = {
  getAll: async (params = {}, config = {}) => {
    const response = await apiClient.get(`${API_PREFIX}`, {
      ...config,
      params,
    });
    return response.data;
  },

  getById: async (id, config = {}) => {
    const response = await apiClient.get(
      `${API_PREFIX}/${encodeURIComponent(id)}`,
      config,
    );
    return response.data;
  },

  create: async (body, config = {}) => {
    const response = await apiClient.post(`${API_PREFIX}`, body, config);
    return response.data;
  },

  update: async (id, body, config = {}) => {
    const response = await apiClient.put(
      `${API_PREFIX}/${encodeURIComponent(id)}`,
      body,
      config,
    );
    return response.data;
  },

  patch: async (id, body, config = {}) => {
    const response = await apiClient.patch(
      `${API_PREFIX}/${encodeURIComponent(id)}`,
      body,
      config,
    );
    return response.data;
  },

  remove: async (id, config = {}) => {
    const response = await apiClient.delete(
      `${API_PREFIX}/${encodeURIComponent(id)}`,
      config,
    );
    return response.data;
  },
};
