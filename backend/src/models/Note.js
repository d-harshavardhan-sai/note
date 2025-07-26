import mongoose from "mongoose";

const noteSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    owner: { // <-- NEW FIELD
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user', // Reference the User model from the Auth project
        required: true
    }
}, {timestamps: true});

const Note = mongoose.model("Note", noteSchema);
export default Note;