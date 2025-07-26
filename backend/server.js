// note/backend/server.js
// THIS MUST BE THE ABSOLUTE VERY FIRST LINE IN THE FILE
import 'dotenv/config'; // <-- ENSURE THIS IS THE FIRST LINE AND ONLY DOTENV IMPORT

import express from "express";
// import dotenv from "dotenv"; // <-- DELETE THIS LINE
import cors from "cors";
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import notesRoutes from "./src/routes/notesRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";

import { connectDB } from "./src/config/db.js";
import rateLimiter from "./src/middleware/rateLimiter.js";

// dotenv.config(); // <-- DELETE THIS LINE (if it exists here)

const app = express();

const PORT = process.env.PORT || 4000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicPath = path.join(__dirname, 'src', 'public');
const uploadsPath = path.join(publicPath, 'uploads');
const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');

try {
  if (!fs.existsSync(publicPath)) { fs.mkdirSync(publicPath, { recursive: true }); }
  if (!fs.existsSync(uploadsPath)) { fs.mkdirSync(uploadsPath, { recursive: true }); }
} catch (err) {
  console.error("Error creating directories:", err);
}

const allowedOrigins = [
  "http://localhost:5173",
  "https://note-three-psi.vercel.app",
  // !!! IMPORTANT: Add your Render service URL here after deployment !!!
  // Example: "https://your-service-name.onrender.com"
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

app.get("/api-status", (req, res) => res.send("Server running and API working!"));
app.use("/api/notes", notesRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);

app.use(express.static(frontendDistPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
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