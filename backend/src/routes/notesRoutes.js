import express from 'express';
import { getAllNotes, createNote, updateNote, deleteNote, getNoteById } from '../controllers/notesController.js';
import userAuth from '../middleware/userAuth.js'; // From Auth project

const router = express.Router();

// Apply userAuth middleware to all notes routes to protect them
router.get('/', userAuth, getAllNotes);
router.get('/:id', userAuth, getNoteById);
router.post('/', userAuth, createNote);
router.put('/:id', userAuth, updateNote);
router.delete('/:id', userAuth, deleteNote);

export default router;