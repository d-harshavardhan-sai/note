import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        // Use the MONGODB_URI from the auth project's .env for consistency
        await mongoose.connect(process.env.MONGODB_URI); 
        console.log("MongoDB connected Successfully");
    } catch (error) {
        console.error("Error connecting to mongoDB", error);
        process.exit(1);
    }
}