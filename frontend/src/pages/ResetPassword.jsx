import React, { useState, useContext } from 'react'; // Ensure useState and useContext are imported
import { assets } from '../assets/assets';
import { useNavigate } from 'react-router-dom'; // Correct import for useNavigate
import { AppContent } from '../context/AppContext'; // Correct import for AppContent context
import axios from 'axios';
import { toast } from 'react-toastify';
import zxcvbn from 'zxcvbn';

const ResetPassword = () => {
  const navigate = useNavigate();
  const { backendUrl } = useContext(AppContent);

  // --- CRITICAL: Ensure this line is present and correct ---
  const [step, setStep] = useState(1); // This declares the 'step' state variable

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordFeedback, setPasswordFeedback] = useState("");
  const [passwordWarning, setPasswordWarning] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  const updatePasswordStrength = (passwordToEvaluate) => {
    if (passwordToEvaluate.length === 0) {
      setPasswordStrength(0);
      setPasswordFeedback("");
      setPasswordWarning("");
      return;
    }
    const result = zxcvbn(passwordToEvaluate);
    setPasswordStrength(result.score);
    setPasswordFeedback(result.feedback.suggestions.join(" ") || "");
    setPasswordWarning(result.feedback.warning || "");
  };

  const handleNewPasswordChange = (e) => {
    const password = e.target.value;
    setNewPassword(password);
    updatePasswordStrength(password);
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      axios.defaults.withCredentials = true;
      const { data } = await axios.post(`${backendUrl}/api/auth/send-reset-otp`, { email });
      if (data.success) {
        toast.success(data.message);
        setStep(2); // Using setStep here
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error("Error sending reset OTP:", error);
      toast.error(error.response?.data?.message || "An error occurred while sending OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (newPassword !== confirmNewPassword) {
        toast.error("New password and confirm password do not match.");
        return;
      }
      if (passwordStrength < 2) {
        toast.error("Please choose a stronger new password.");
        return;
      }

      axios.defaults.withCredentials = true;
      const response = await axios.post(`${backendUrl}/api/auth/reset-password`, {
        email,
        otp,
        newPassword
      });

      if (response.data.success) {
        toast.success(response.data.message);
        navigate('/login');
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      toast.error(error.response?.data?.message || "An error occurred while resetting password.");
    } finally {
      setIsLoading(false);
    }
  };

  const getStrengthBarColor = (score) => {
    switch (score) {
      case 0: return "bg-red-500";
      case 1: return "bg-orange-500";
      case 2: return "bg-yellow-500";
      case 3: return "bg-blue-500";
      case 4: return "bg-green-500";
      default: return "bg-gray-300";
    }
  };

  const getStrengthText = (score) => {
    switch (score) {
      case 0: return "Very Weak";
      case 1: return "Weak";
      case 2: return "Fair";
      case 3: return "Good";
      case 4: return "Strong";
      default: return "";
    }
  };

  return (
    <div className='flex items-center justify-center min-h-screen px-6 sm:px-0'>
      <img
        onClick={() => navigate("/")}
        src={assets.logo}
        alt=""
        className="absolute left-5 sm:left-20 top-5 w-28 sm:w-32 cursor-pointer"
      />
      <div className="bg-white p-8 rounded-lg w-96 text-sm">
        <h2 className="text-violet-500 text-2xl font-semibold text-center mb-4">Email Verify OTP</h2>
        <p className="text-pink-400 text-center mb-6">Enter the 6-digit code sent to your email id</p>

        {step === 1 ? ( // Using 'step' here
          <form onSubmit={handleSendOtp}>
            <div className="mb-4 flex items-center gap-3 w-full px-5 py-2.5 rounded-full bg-[#f0f5ff]">
              <img src={assets.mail} alt="" className="w-6 h-6" />
              <input
                onChange={(e) => setEmail(e.target.value)}
                value={email}
                className="bg-[#f0f5ff] outline-none text-violet-400 font-bold w-full"
                type="email"
                placeholder="Email id"
                autoComplete="email"
                required
              />
            </div>
            <button
              type="submit"
              className="bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 w-full py-2.5 rounded-full text-white font-semibold flex items-center justify-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                "Send OTP"
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            <div className="mb-4 flex items-center gap-3 w-full px-5 py-2.5 rounded-full bg-[#f0f5ff]">
              <input
                onChange={(e) => setOtp(e.target.value)}
                value={otp}
                className="bg-[#f0f5ff] outline-none text-violet-400 font-bold w-full"
                type="text"
                placeholder="Enter OTP"
                maxLength="6"
                required
                autoComplete="one-time-code"
              />
            </div>
            <div className="mb-4 flex items-center gap-3 w-full px-5 py-2.5 rounded-full bg-[#f0f5ff]">
              <img src={assets.lock} alt="" className="w-6 h-6" />
              <input
                onChange={handleNewPasswordChange}
                value={newPassword}
                className="bg-[#f0f5ff] outline-none text-violet-400 font-bold w-full"
                type="password"
                placeholder="New Password"
                autoComplete="new-password"
                required
              />
            </div>

            {/* Password Strength Meter */}
            {newPassword.length > 0 && (
              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`${getStrengthBarColor(passwordStrength)} h-2.5 rounded-full`}
                    style={{ width: `${(passwordStrength + 1) * 20}%` }}
                  ></div>
                </div>
                <p className={`text-xs mt-1 ${getStrengthBarColor(passwordStrength).replace('bg', 'text')}`}>
                  Strength: {getStrengthText(passwordStrength)}
                </p>
                {passwordWarning && (
                  <p className="text-red-300 text-xs mt-1">
                    Warning: {passwordWarning}
                  </p>
                )}
                {passwordFeedback && (
                  <p className="text-gray-300 text-xs mt-1">
                    Suggestions: {passwordFeedback}
                  </p>
                )}
              </div>
            )}

            <div className="mb-4 flex items-center gap-3 w-full px-5 py-2.5 rounded-full bg-[#f0f5ff]">
              <input
                type="password"
                placeholder="Confirm New Password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="bg-[#f0f5ff] outline-none text-violet-400 font-bold w-full"
                autoComplete="new-password"
                required
              />
            </div>


            <button
              type="submit"
              className="bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 w-full py-2.5 rounded-full text-white font-semibold flex items-center justify-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                "Reset Password"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;