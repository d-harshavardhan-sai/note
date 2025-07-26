import userModel from '../models/userModel.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../public/uploads');

export const getUserData = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await userModel.findById(userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }
        res.json({ success: true, userData: { _id: user._id, name: user.name, email: user.email, isAccountVerfied: user.isAccountVerfied, profilePicture: user.profilePicture } });
    } catch (error) {
        console.error("Error fetching user data:", error);
        return res.json({ success: false, message: error.message });
    }
};

export const updateProfile = async (req, res) => {
    console.log("--- Inside updateProfile controller ---");
    console.log("Full req.body object received by controller:", req.body);
    console.log("req.file (uploaded file info):", req.file);
    console.log("Value of req.body.name:", req.body.name);
    console.log("Value of req.body.userId:", req.body.userId);

    const nameToUse = req.body.name;
    const userIdToUse = req.body.userId;

    if (!nameToUse || nameToUse.trim() === '') {
        console.error("Validation failed: 'name' is empty or missing in req.body.");
        return res.json({ success: false, message: "Name is required" });
    }
    if (!userIdToUse) {
        console.error("Validation failed: 'userId' is missing in req.body. This shouldn't happen after userAuth middleware.");
        return res.status(401).json({ success: false, message: "Authentication Error: User ID missing or invalid." });
    }

    const profilePictureFile = req.file;

    try {
        const user = await userModel.findById(userIdToUse);
        if (!user) {
            console.error(`User not found in DB for userId: ${userIdToUse}`);
            return res.json({ success: false, message: "User not found" });
        }

        user.name = nameToUse.trim();

        if (profilePictureFile) {
            user.profilePicture = `${req.protocol}://${req.get('host')}/public/uploads/${profilePictureFile.filename}`;
            console.log("New profile picture URL set:", user.profilePicture);
        } else if (req.body.profilePicture === '') {
            user.profilePicture = '';
            console.log("Profile picture explicitly cleared.");
        }

        await user.save();

        res.json({ success: true, message: "Profile updated successfully", userData: { name: user.name, email: user.email, isAccountVerfied: user.isAccountVerfied, profilePicture: user.profilePicture } });
    } catch (error) {
        console.error("Error updating profile in database:", error);
        return res.status(500).json({ success: false, message: `Server error during profile update: ${error.message}` });
    }
};

export const changePassword = async (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.json({ success: false, message: "Please provide current and new password" });
    }

    try {
        const user = await userModel.findById(userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.json({ success: false, message: "Current password is incorrect" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        console.error("Error changing password:", error);
        return res.json({ success: false, message: error.message });
    }
};

export const deleteAccount = async (req, res) => {
    const { userId, currentPassword } = req.body;

    if (!currentPassword) {
        return res.json({ success: false, message: "Please enter your password to confirm deletion." });
    }

    try {
        const user = await userModel.findById(userId);
        if (!user) {
            return res.json({ success: false, message: "User not found." });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.json({ success: false, message: "Incorrect password. Account not deleted." });
        }

        await userModel.findByIdAndDelete(userId);

        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        });

        res.json({ success: true, message: "Account deleted successfully." });
    } catch (error) {
        console.error("Error deleting account:", error);
        return res.status(500).json({ success: false, message: `Server error during account deletion: ${error.message}` });
    }
};