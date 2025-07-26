// note/backend/server.js
import 'dotenv/config';
import cors from "cors";
import express from "express";
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import notesRoutes from "./src/routes/notesRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";

import { connectDB } from "./src/config/db.js";
import rateLimiter from "./src/middleware/rateLimiter.js";

const app = express();

const PORT = process.env.PORT || 4000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicPath = path.join(__dirname, 'src', 'public');
const uploadsPath = path.join(publicPath, 'uploads');
const frontendDistPath = path.join(__dirname, 'dist'); // This path assumes frontend is copied here

try {
  if (!fs.existsSync(publicPath)) { fs.mkdirSync(publicPath, { recursive: true }); }
  if (!fs.existsSync(uploadsPath)) { fs.mkdirSync(uploadsPath, { recursive: true }); }
} catch (err) {
  console.error("Error creating directories:", err);
}

const allowedOrigins = [
  "http://localhost:5173", // Keep for local development
  "https://note-three-psi.vercel.app", // Your old Vercel frontend (if still using for anything)
  "https://note-chnx.onrender.com" // <-- ADD YOUR RENDER SERVICE URL HERE
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
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/public', express.static(publicPath));

app.use(rateLimiter);

// API Routes
app.get("/api-status", (req, res) => res.send("Server running and API working!"));
app.use("/api/notes", notesRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);

// Serve frontend static files
// This must come AFTER API routes.
app.use(express.static(frontendDistPath));

// Fallback for SPA routing: For any other GET request, send index.html
app.get('*', (req, res) => {
  const indexPath = path.join(frontendDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error(`Error: index.html not found at ${indexPath}`);
    res.status(404).send('Frontend index.html not found.');
  }
});


app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err.stack);
  res.status(500).send('Something broke on the server!');
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server started and running at http://localhost:${PORT}`);
    console.log(`Frontend served from: ${frontendDistPath}`);
  });
}).catch(err => {
    console.error("Failed to connect to database and start server:", err);
    process.exit(1);
});