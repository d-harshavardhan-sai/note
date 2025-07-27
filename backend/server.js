import 'dotenv/config';

import express from "express";
import cors from "cors";
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs'; // Ensure fs is imported

import notesRoutes from "./src/routes/notesRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import userRoutes from "./src/routes/userRoutes.js"; // Ensure correct path for userRoutes

import { connectDB } from "./src/config/db.js";
import rateLimiter from "./src/middleware/rateLimiter.js";

const app = express();

const PORT = process.env.PORT || 4000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicPath = path.join(__dirname, 'src', 'public'); // For profile pictures
const uploadsPath = path.join(publicPath, 'uploads');

try {
  if (!fs.existsSync(publicPath)) { fs.mkdirSync(publicPath, { recursive: true }); }
  if (!fs.existsSync(uploadsPath)) { fs.mkdirSync(uploadsPath, { recursive: true }); }
} catch (err) {
  console.error("Error creating directories:", err);
}

// Allowed origins for CORS: Must include your Vercel frontend URL(s)
const allowedOrigins = [
  "http://localhost:5173", // For local frontend development
  "https://note-alpha-lilac.vercel.app" // Your Vercel frontend URL from the logs
  // Add any other specific frontend URLs that need to access this backend (e.g., custom domains)
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // Allow cookies to be sent cross-origin
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve profile pictures statically (will be accessed by frontend at /public/uploads)
app.use('/public', express.static(publicPath));

app.use(rateLimiter);

// API Routes (ONLY API routes are served by this backend now)
app.get("/api-status", (req, res) => res.send("Server running and API working!"));
app.use("/api/notes", notesRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);

// *** IMPORTANT: REMOVE ALL FRONTEND SERVING LOGIC FROM HERE ***
// app.use(express.static(frontendDistPath)); // DELETE this line if it's uncommented
// app.get('*', ...) // DELETE this entire block if it's uncommented

app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err.stack);
  res.status(500).send('Something broke on the server!');
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server started and running at http://localhost:${PORT}`);
    // console.log(`Frontend served from: ${frontendDistPath}`); // DELETE this log
  });
}).catch(err => {
    console.error("Failed to connect to database and start server:", err);
    process.exit(1);
});