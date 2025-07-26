import Note from "../models/Note.js";

export async function getAllNotes(req, res) {
  // Access userId from the req object (set by userAuth middleware)
  const userId = req.userId; 
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: User not logged in." });
  }

  try {
    // Only fetch notes belonging to the authenticated user
    const notes = await Note.find({ owner: userId }).sort({ createdAt: -1 });
    res.status(200).json(notes);
  } catch (error) {
    console.error("Error in getAllNotes controller", error);
    res.status(500).json("Internal server error");
  }
}

export async function getNoteById(req, res) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: User not logged in." });
  }

  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    // Ensure the note belongs to the authenticated user
    if (note.owner.toString() !== userId) {
      return res.status(403).json({ message: "Forbidden: You do not own this note." });
    }
    res.status(200).json(note);
  } catch (error) {
    console.error("Error in getNoteById controller", error);
    res.status(500).json("Internal server error");
  }
}

export async function createNote(req, res) {
  const userId = req.userId; // Get userId from authenticated request
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: User not logged in." });
  }

  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ message: "Title and content are required." });
    }
    // Assign the authenticated user as the owner of the note
    const note = new Note({ title, content, owner: userId }); 
    const savedNote = await note.save();
    res.status(201).json(savedNote);
  } catch (error) {
    console.error("Error in createNote controller", error);
    res.status(500).json("Internal server error");
  }
}

export async function updateNote(req, res) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: User not logged in." });
  }

  try {
    const { title, content } = req.body;
    
    // Find the note first to check ownership
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    // Ensure the note belongs to the authenticated user
    if (note.owner.toString() !== userId) {
      return res.status(403).json({ message: "Forbidden: You do not own this note." });
    }

    // Update the note
    note.title = title || note.title; // Allow partial updates
    note.content = content || note.content;
    const updatedNote = await note.save();

    res.status(200).json(updatedNote);
  } catch (error) {
    console.error("Error in updateNote controller", error);
    res.status(500).json("Internal server error");
  }
}

export async function deleteNote(req, res) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: User not logged in." });
  }

  try {
    // Find the note first to check ownership
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    // Ensure the note belongs to the authenticated user
    if (note.owner.toString() !== userId) {
      return res.status(403).json({ message: "Forbidden: You do not own this note." });
    }
    
    await note.deleteOne(); // Use deleteOne() on the found document

    res.status(200).json({ message: "Note deleted successfully" });
  } catch (error) {
    console.error("Error in deleteNote controller", error);
    res.status(500).json("Internal server error");
  }
}