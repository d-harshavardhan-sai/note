import React, { useContext, useState } from "react";
import { assets } from "../assets/assets.js";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../context/AppContext.jsx";
import axios from "axios";
import { toast } from "react-toastify";

const EmailVerify = () => {
  const navigate = useNavigate();
  const { userData, backendUrl, getUserData } = useContext(AppContent);

  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmitHandler = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      axios.defaults.withCredentials = true;
      if (!userData || !userData._id) {
        toast.error("User not defined. Please log in.");
        return;
      }

      const { data } = await axios.post(
        `${backendUrl}/api/auth/verify-account`,
        { userId: userData._id, otp }
      );

      if (data.success) {
        toast.success(data.message);
        await getUserData();
        navigate("/");
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error("Error verifying email:", error);
      toast.error(error.response?.data?.message || "An error occurred during verification.");
    } finally {
      setIsLoading(false);
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
      <form onSubmit={onSubmitHandler} className="bg-white p-8 rounded-lg w-96 text-sm">
        <h1 className="text-violet-500 text-2xl font-semibold text-center mb-4">Email Verify OTP</h1>
        <p className="text-pink-400 text-center mb-6">Enter the 6-digit code sent to your email id</p>
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
            "Verify Email"
          )}
        </button>
      </form>
    </div>
  );
};

export default EmailVerify;