import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import notesRoutes from "./src/routes/notesRoutes.js";
import { connectDB } from "./src/config/db.js";
import rateLimiter from "./src/middleware/rateLimiter.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5001;

//middleware
const allowedOrigins = [
  "http://localhost:5173", // local dev
  "https://note-three-psi.vercel.app", // production (Vercel frontend)
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
    credentials: true, // allow credentials if needed in future
  })
);

app.use(express.json());

app.use(rateLimiter);

app.use("/api/notes", notesRoutes);

connectDB().then(() => {
  app.listen(PORT, (req, res) => {
    console.log("Server started and running at", PORT);
  });
});
