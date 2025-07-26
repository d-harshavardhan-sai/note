import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import transporter from "../config/nodemailer.js"; // Ensure transporter is correctly imported

export const register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.json({ success: false, message: "Please fill all fields" });
  }

  try {
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new userModel({ name, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // --- DEBUGGING LOGS FOR SMTP CREDENTIALS ---
    console.log("SMTP_USER from .env:", process.env.SMTP_USER);
    console.log("SMTP_PASS from .env:", process.env.SMTP_PASS ? "Set (not printed for security)" : "Not Set");
    // --- END DEBUGGING LOGS ---

    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: "Welcome to Divvala Community",
      html: `
        <h2>Hello ${name},</h2>
        <p>Thank you for registering with <strong>Divvala Community</strong>! We're excited to have you on board.</p>
        <p>You can now log in using your registered email: <strong>${email}</strong>.</p>
        <p><em>Please remember to change your password after logging in for security reasons.</em></p>
        <br/>
        <p>Best regards,</p>
        <p><strong>Divvala Team</strong></p>
      `,
    };
    await transporter.sendMail(mailOptions); // This is where the error occurs

    res.json({ success: true, message: "User registered successfully", user });
  } catch (error) {
    console.error("Error during registration (including email sending):", error); // More specific log
    return res.json({ success: false, message: error.message });
  }
};


export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.json({ success: false, message: "Please fill all fields" });
  }

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ success: true, message: "User Logged In Successfully", user });
  } catch (error) {
    console.error("Error during login:", error);
    return res.json({ success: false, message: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
    res.json({ success: true, message: "User logged out successfully" });
  } catch (error) {
    console.error("Error during logout:", error);
    return res.json({ success: false, message: error.message });
  }
};

export const sendVerifyOtp = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await userModel.findById(userId);
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }
    if (user.isAccountVerfied) {
      return res.json({ success: false, message: "Account already verified" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.verifyOtp = otp;
    user.verifyExpiresIn = Date.now() + 24 * 60 * 60 * 1000; // 24 hrs expiry

    await user.save();

    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "Divvala Community - Verify Your Account",
      html: `
        <h2>Hello ${user.name},</h2>
        <p>Thank you for registering with <strong>Divvala Community</strong>! To complete your registration, please verify your account using the OTP below:</p>
        <h3 style="color: #4CAF50;">${otp}</h3>
        <p>This OTP is valid for 24 hours. If you did not request this, please ignore this email.</p>
        <br/>
        <p>Best regards,</p>
        <p><strong>Divvala Team</strong></p>
      `,
    };
    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error sending verification OTP:", error);
    return res.json({ success: false, message: error.message });
  }
};

export const verifyEmail = async (req, res) => {
  const { userId, otp } = req.body;
  if (!userId || !otp) {
    return res.json({
      success: false,
      message: "Please provide userId and OTP",
    });
  }

  try {
    const user = await userModel.findById(userId);
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }
    if (user.isAccountVerfied) {
      return res.json({ success: false, message: "Account already verified." });
    }
    if (user.verifyOtp === "" || user.verifyOtp !== otp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }
    if (user.verifyExpiresIn < Date.now()) {
      return res.json({ success: false, message: "OTP expired" });
    }
    user.isAccountVerfied = true;
    user.verifyOtp = "";
    user.verifyExpiresIn = 0;
    await user.save();

    res.json({ success: true, message: "Account verified successfully" });
  } catch (error) {
    console.error("Error verifying email:", error);
    return res.json({ success: false, message: error.message });
  }
};

export const isAuthenticated = async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.json({ success: false, message: "No token found" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(decoded.id);
    if (!user) {
      return res.json({ success: false, message: "User not found (from token)" });
    }
    return res.json({
      success: true,
      message: "User is authenticated",
      userId: decoded.id,
    });
  } catch (error) {
    console.error("Error in isAuthenticated:", error);
    return res.json({ success: false, message: "Invalid or expired token" });
  }
};

export const sendResetOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.json({ success: false, message: "Please provide an email" });
  }

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.resetOtp = otp;
    user.resetExpiresIn = Date.now() + 15 * 60 * 1000; // 15 mins expiry

    await user.save();

    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: "Divvala Community - Reset Your Password",
      html: `
        <h2>Hello ${user.name},</h2>
        <p>We received a request to reset your password for your <strong>Divvala Community</strong> account. Please use the OTP below to reset your password:</p>
        <h3 style="color: #4CAF50;">${otp}</h3>
        <p>This OTP is valid for 15 minutes. If you did not request this, please ignore this email.</p>
        <br/>
        <p>Best regards,</p>
        <p><strong>Divvala Team</strong></p>
      `,
    };
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Reset OTP sent successfully" });
  } catch (error) {
    console.error("Error sending reset OTP:", error);
    return res.json({ success: false, message: error.message });
  }
};

export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.json({
      success: false,
      message: "Please provide email, OTP and new password",
    });
  }

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }
    if (user.resetOtp === "" || user.resetOtp !== otp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }
    if (user.resetExpiresIn < Date.now()) {
      return res.json({ success: false, message: "OTP expired" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetOtp = "";
    user.resetExpiresIn = 0;
    await user.save();

    res.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res.json({ success: false, message: error.message });
  }
};