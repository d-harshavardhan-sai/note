import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // Google SMTP server
    port: 465, // Port for SSL
    secure: true, // Use SSL
    auth: {
        user: process.env.SMTP_USER.trim(), // Your Gmail address (from .env)
        pass: process.env.SMTP_PASS.trim(), // Your generated Gmail App Password (from .env)
    }
    // Removed debug: true and logger: true as they are not needed for a working setup
});

export default transporter;