import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { getUserData, updateProfile, changePassword, deleteAccount } from '../controllers/userController.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../public/uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

const userRouter = express.Router();
userRouter.post('/data', userAuth, getUserData);
userRouter.post('/update-profile', userAuth, upload.single('profilePicture'), updateProfile);
userRouter.post('/change-password', userAuth, changePassword);
userRouter.post('/delete-account', userAuth, deleteAccount);


export default userRouter;