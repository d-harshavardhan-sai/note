import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {type: String, required: true},
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {type: String, required: true},
    profilePicture: {type: String, default: ''},
    verifyOtp: {type: String, default: ''},
    verifyExpiresIn: {type: Number, default: 0},
    isAccountVerfied: {type: Boolean, default: false},
    resetOtp: {type: String, default: ''},
    resetExpiresIn: {type: Number, default: 0}
})

// Ensure the model name matches the 'ref' in Note.js ('user')
const user = mongoose.models.user || mongoose.model('user', userSchema);

export default user;