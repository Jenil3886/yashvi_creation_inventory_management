import axios from "axios";

// Fallback to localhost if no ENV variables are configured
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "https://shc3zgjl-3000.inc1.devtunnels.ms/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor to inject JWT Authorization token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("yc_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export default apiClient;
