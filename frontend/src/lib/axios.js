import axios from "axios";

const BASE_URL =
  import.meta.env.MODE === "development"
    ? import.meta.env.VITE_BACKEND_URL + "/api" // Local dev still uses localhost:4000/api
    : "/api"; // <-- UPDATED FOR PRODUCTION: Points to /api on the same host (Render URL)

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

export default api;