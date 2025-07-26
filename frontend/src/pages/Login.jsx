import React, { useContext, useState } from "react";
import { assets } from "../assets/assets";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../context/AppContext";
import axios from "axios";
import { toast } from "react-toastify";
import zxcvbn from "zxcvbn";

const Login = () => {
  const navigate = useNavigate();

  const { backendUrl, setIsLoggedIn, getUserData } = useContext(AppContent);

  const [state, setState] = useState("Sign Up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordFeedback, setPasswordFeedback] = useState("");
  const [passwordWarning, setPasswordWarning] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  const updatePasswordStrength = (newPassword) => {
    if (state === "Sign Up") {
      const result = zxcvbn(newPassword);
      setPasswordStrength(result.score);
      setPasswordFeedback(result.feedback.suggestions.join(" ") || "");
      setPasswordWarning(result.feedback.warning || "");
    } else {
      setPasswordStrength(0);
      setPasswordFeedback("");
      setPasswordWarning("");
    }
  };

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    updatePasswordStrength(newPassword);
  };

  const onSubmitHandler = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      axios.defaults.withCredentials = true;

      if (state === "Sign Up") {
        if (passwordStrength < 2) {
          toast.error("Please choose a stronger password.");
          return;
        }

        const res = await axios.post(`${backendUrl}/api/auth/register`, {
          name,
          email,
          password,
        });
        const data = res.data;
        console.log("Register response:", data);

        if (data.success) {
          setIsLoggedIn(true);
          await getUserData();
          navigate("/");
          toast.success(data.message);
        } else {
          toast.error(data.message || "Registration failed");
        }
      } else {
        const res = await axios.post(`${backendUrl}/api/auth/login`, {
          email,
          password,
        });
        const data = res.data;
        console.log("Login response:", data);

        if (data.success) {
          setIsLoggedIn(true);
          await getUserData();
          navigate("/");
          toast.success(data.message);
        } else {
          toast.error(data.message || "Login failed");
        }
      }
    } catch (error) {
      console.error("Error during auth:", error);
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error("An unexpected error occurred");
      }
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
      <div className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 rounded-lg shadow-lg p-10 w-full sm:w-96 text-sm">
        <h2 className="text-3xl  font-semibold text-white text-center mb-3">
          {state === "Sign Up" ? "Create Account" : "Login"}
        </h2>
        <p className="text-center text-white text-sm mb-6">
          {state === "Sign Up"
            ? "Create your Account"
            : "Login to your account !"}
        </p>

        <form onSubmit={onSubmitHandler}>
          {state === "Sign Up" && (
            <div className="mb-4 flex items-center gap-3 w-full px-5 py-2.5 rounded-full bg-[#f0f5ff]">
              <img src={assets.person} alt="" className="w-6 h-6" />
              <input
                onChange={(e) => setName(e.target.value)}
                value={name}
                className="bg-[#f0f5ff] outline-none text-violet-400 font-bold"
                type="text"
                placeholder="Full Name"
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="mb-4 flex items-center gap-3 w-full px-5 py-2.5 rounded-full bg-[#f0f5ff]">
            <img src={assets.mail} alt="" className="w-6 h-6" />
            <input
              onChange={(e) => setEmail(e.target.value)}
              value={email}
              className="bg-[#f0f5ff] outline-none text-violet-400 font-bold"
              type="email"
              placeholder="Email id"
              autoComplete="email"
              required
            />
          </div>

          <div className="mb-4 flex items-center gap-3 w-full px-5 py-2.5 rounded-full bg-[#f0f5ff]">
            <img src={assets.lock} alt="" className="w-6 h-6" />
            <input
              onChange={handlePasswordChange}
              value={password}
              className="bg-[#f0f5ff] outline-none text-violet-400 font-bold"
              type="password"
              placeholder="Password"
              autoComplete={state === "Sign Up" ? "new-password" : "current-password"}
              required
            />
          </div>

          {/* Password Strength Meter */}
          {state === "Sign Up" && password.length > 0 && (
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

          {/* Conditional rendering of Forgot Password link */}
          {state === "Login" && (
            <p
              onClick={() => navigate("/reset-password")}
              className="mb-4 text-purple-100 font-bold cursor-pointer"
            >
              Forgot password ?
            </p>
          )}

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
              state
            )}
          </button>
        </form>

        {state === "Sign Up" ? (
          <p className="text-purple-100 text-sm  text-center  mt-4">
            Already have account?{" "}
            <span
              onClick={() => {
                setState("Login");
                updatePasswordStrength("");
              }}
              className="text-purple-100 font-bold cursor-pointer underline"
            >
              Login here
            </span>
          </p>
        ) : (
          <p className="text-purple-100 text-sm  text-center  mt-4">
            Don't have an account?{" "}
            <span
              onClick={() => {
                setState("Sign Up");
                updatePasswordStrength("");
              }}
              className="text-purple-100 font-bold cursor-pointer underline"
            >
              Sign up
            </span>
          </p>
        )}
      </div>
    </div>
  );
};

export default Login;