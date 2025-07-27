import axios from "axios";

const BASE_URL =
  import.meta.env.MODE === "development"
    ? import.meta.env.VITE_BACKEND_URL + "/api" // For local dev (e.g., http://localhost:4000/api)
    : "https://note-chnx.onrender.com/api"; // <-- CRUCIAL: Replace with your Render Backend's PUBLIC URL

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Needed for sending cookies (JWT) cross-origin
});

export default api;