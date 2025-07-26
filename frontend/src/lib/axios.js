import axios from "axios";

// Base URL points to the combined backend (running on PORT 4000)
const BASE_URL = import.meta.env.MODE === "development"
  ? import.meta.env.VITE_BACKEND_URL + "/api" // Use VITE_BACKEND_URL from .env
  : "https://note-chnx.onrender.com/api";  // UPDATE THIS FOR PRODUCTION DEPLOYMENT

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Crucial for sending cookies (JWT) with requests
});

export default api;