import { Link } from "react-router-dom";
import { PlusIcon, MenuIcon } from "lucide-react";
import React, { useContext, useState } from "react";
import { assets } from "../assets/assets.js";
import { AppContent } from "../context/AppContext.jsx";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate, useLocation } from "react-router-dom";

const Navbar = () => {
  const { userData, backendUrl, setUserData, setIsLoggedIn, setCurrentTheme, setCurrentFont, currentTheme, currentFont } =
    useContext(AppContent);
  const [showSettings, setShowSettings] = useState(false);
  const [isVerifyingLoading, setIsVerifyingLoading] = useState(false);
  const [isLogoutLoading, setIsLogoutLoading] = useState(false);

  // State to control user dropdown visibility
  const [showUserDropdown, setShowUserDropdown] = useState(false); // NEW STATE

  const navigate = useNavigate();
  const location = useLocation();

  // Define routes where the "New Note" button should NOT appear
  const authRoutes = ['/login', '/email-verify', '/profile', '/reset-password'];
  const showNewNoteButton = !authRoutes.includes(location.pathname);

  const sendVerificationOtp = async () => {
    setIsVerifyingLoading(true);
    try {
      axios.defaults.withCredentials = true;

      if (!userData || !userData._id) {
        toast.error("User is not defined or user ID is missing.");
        return;
      }

      const { data } = await axios.post(
        backendUrl + '/api/auth/send-verify-otp',
        { userId: userData._id }
      );

      if (data.success) {
        navigate('/email-verify');
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error("Error sending verification OTP:", error);
      toast.error(error.response?.data?.message || "An error occurred while sending OTP.");
    } finally {
      setIsVerifyingLoading(false);
    }
  };

  const logout = async () => {
    setIsLogoutLoading(true);
    try {
      axios.defaults.withCredentials = true;
      const { data } = await axios.post(backendUrl + "/api/auth/logout");
      data.success && setIsLoggedIn(false);
      data.success && setUserData(null);
      navigate("/");
      data.success && toast.success(data.message);
    } catch (error) {
      console.error("Error during logout:", error);
      toast.error(error.response?.data?.message || "An error occurred during logout.");
    } finally {
      setIsLogoutLoading(false);
    }
  };

  // Close dropdown if clicked outside
  const dropdownRef = React.useRef(null);
  React.useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);


  return (
    <header className="bg-base-300 border-b border-base-content/10"> {/* DaisyUI base classes retained */}
      <div className="mx-auto max-w-6xl p-4">
        <div className="flex items-center justify-between">
          <h1
            onClick={() => navigate("/")}
            className="text-3xl font-bold text-primary font-mono tracking-tight cursor-pointer" 
          >
            ThinkBoard
          </h1>
          <div className="flex items-center gap-4">
            {userData ? (
              <>
                {showNewNoteButton && (
                  <Link to={"/create"} className="btn btn-primary"> {/* DaisyUI base classes retained */}
                    <PlusIcon className="size-5" />
                    <span className="whitespace-nowrap">New Note</span>
                  </Link>
                )}

                {/* Custom User Dropdown (instead of DaisyUI dropdown) */}
                <div className="relative" ref={dropdownRef}> {/* Added ref */}
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 text-white flex items-center justify-center text-xl cursor-pointer"
                  >
                    {userData.name[0].toUpperCase()}
                  </button>

                  {showUserDropdown && (
                    <ul className="absolute top-12 right-0 z-10 p-2 shadow-lg rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--text-color)] min-w-[12rem] whitespace-nowrap"> {/* Themed classes */}
                      <li className="py-1 px-2 hover:bg-[var(--list-item-hover-bg)] cursor-pointer transition-colors">
                        <Link to="/profile" onClick={() => setShowUserDropdown(false)}>Profile</Link>
                      </li>
                      {!userData.isAccountVerfied && (
                        <li
                          onClick={sendVerificationOtp}
                          className={`py-1 px-2 cursor-pointer transition-colors ${isVerifyingLoading ? 'text-[var(--text-muted)] pointer-events-none' : 'hover:bg-[var(--list-item-hover-bg)]'}`}
                          disabled={isVerifyingLoading}
                        >
                          <span className="flex items-center gap-1">
                            {isVerifyingLoading ? (
                              <>
                                <svg className="animate-spin h-4 w-4 text-[var(--text-muted)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Sending...
                              </>
                            ) : (
                              "Verify email"
                            )}
                          </span>
                        </li>
                      )}
                      <li
                        onClick={logout}
                        className={`py-1 px-2 cursor-pointer transition-colors ${isLogoutLoading ? 'text-[var(--text-muted)] pointer-events-none' : 'hover:bg-[var(--list-item-hover-bg)]'}`}
                        disabled={isLogoutLoading}
                      >
                        <span className="flex items-center gap-1">
                          {isLogoutLoading ? (
                            <>
                              <svg className="animate-spin h-4 w-4 text-[var(--text-muted)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Logging out...
                            </>
                          ) : (
                            "Logout"
                          )}
                        </span>
                      </li>
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <Link to={"/login"} className="btn btn-primary"> {/* DaisyUI base classes retained */}
                <span>Login / Sign Up</span>
              </Link>
            )}

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="btn btn-ghost btn-circle"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-end">
          <div className="bg-[var(--card-bg)] w-64 p-6 shadow-lg relative h-full overflow-y-auto text-[var(--text-color)]"> {/* Themed classes */}
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 text-gray-600 hover:text-gray-900"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
            <h3 className="text-xl font-semibold text-[var(--text-color)] mb-6 mt-4">App Settings</h3> {/* Themed text */}

            <div className="mb-8">
              <h4 className="text-lg font-medium text-[var(--text-muted)] mb-3">Theme Type</h4> {/* Themed text */}
              <div className="flex flex-col gap-2">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]" /* Themed accent */
                    name="theme"
                    value="light"
                    checked={currentTheme === 'light'}
                    onChange={() => setCurrentTheme('light')}
                  />
                  <span className="ml-2 text-[var(--text-muted)]">Light</span> {/* Themed text */}
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="theme"
                    value="dark"
                    checked={currentTheme === 'dark'}
                    onChange={() => setCurrentTheme('dark')}
                  />
                  <span className="ml-2 text-[var(--text-muted)]">Dark</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="theme"
                    value="corporate"
                    checked={currentTheme === 'corporate'}
                    onChange={() => setCurrentTheme('corporate')}
                  />
                  <span className="ml-2 text-[var(--text-muted)]">Corporate</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="theme"
                    value="cyberpunk"
                    checked={currentTheme === 'cyberpunk'}
                    onChange={() => setCurrentTheme('cyberpunk')}
                  />
                  <span className="ml-2 text-[var(--text-muted)]">Cyberpunk</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="theme"
                    value="nature"
                    checked={currentTheme === 'nature'}
                    onChange={() => setCurrentTheme('nature')}
                  />
                  <span className="ml-2 text-[var(--text-muted)]">Nature</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="theme"
                    value="retro"
                    checked={currentTheme === 'retro'}
                    onChange={() => setCurrentTheme('retro')}
                  />
                  <span className="ml-2 text-[var(--text-muted)]">Retro</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="theme"
                    value="mono"
                    checked={currentTheme === 'mono'}
                    onChange={() => setCurrentTheme('mono')}
                  />
                  <span className="ml-2 text-[var(--text-muted)]">Monochromatic</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="theme"
                    value="warm"
                    checked={currentTheme === 'warm'}
                    onChange={() => setCurrentTheme('warm')}
                  />
                  <span className="ml-2 text-[var(--text-muted)]">Warm Sunset</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="theme"
                    value="cool"
                    checked={currentTheme === 'cool'}
                    onChange={() => setCurrentTheme('cool')}
                  />
                  <span className="ml-2 text-[var(--text-muted)]">Cool Ocean</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="theme"
                    value="high-contrast"
                    checked={currentTheme === 'high-contrast'}
                    onChange={() => setCurrentTheme('high-contrast')}
                  />
                  <span className="ml-2 text-[var(--text-muted)]">High Contrast</span>
                </label>
              </div>
            </div>

            <div className="mb-8">
              <h4 className="text-lg font-medium text-[var(--text-muted)] mb-3">Font Type</h4> {/* Themed text */}
              <div className="flex flex-col gap-2">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="font"
                    value="Poppins"
                    checked={currentFont === 'Poppins'}
                    onChange={() => setCurrentFont('Poppins')}
                  />
                  <span className="ml-2 text-[var(--text-muted)] font-poppins">Poppins</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="font"
                    value="Ubuntu"
                    checked={currentFont === 'Ubuntu'}
                    onChange={() => setCurrentFont('Ubuntu')}
                  />
                  <span className="ml-2 text-[var(--text-muted)] font-ubuntu">Ubuntu</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="font"
                    value="Londrina Sketch"
                    checked={currentFont === 'Londrina Sketch'}
                    onChange={() => setCurrentFont('Londrina Sketch')}
                  />
                  <span className="ml-2 text-[var(--text-muted)] font-londrina">Sketchy</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="font"
                    value="Pixelify Sans"
                    checked={currentFont === 'Pixelify Sans'}
                    onChange={() => setCurrentFont('Pixelify Sans')}
                  />
                  <span className="ml-2 text-[var(--text-muted)] font-pixelify">Pixel</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="font"
                    value="Comfortaa"
                    checked={currentFont === 'Comfortaa'}
                    onChange={() => setCurrentFont('Comfortaa')}
                  />
                  <span className="ml-2 text-[var(--text-muted)] font-comfortaa">Rounded</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="font"
                    value="Playwrite Australia QLD"
                    checked={currentFont === 'Playwrite Australia QLD'}
                    onChange={() => setCurrentFont('Playwrite Australia QLD')}
                  />
                  <span className="ml-2 text-[var(--text-muted)] font-playwrite">Playwrite</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="font"
                    value="Creepster"
                    checked={currentFont === 'Creepster'}
                    onChange={() => setCurrentFont('Creepster')}
                  />
                  <span className="ml-2 text-[var(--text-muted)] font-creepster">Creepy</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="font"
                    value="Indie Flower"
                    checked={currentFont === 'Indie Flower'}
                    onChange={() => setCurrentFont('Indie Flower')}
                  />
                  <span className="ml-2 text-[var(--text-muted)] font-indie">Indie</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="font"
                    value="Finger Paint"
                    checked={currentFont === 'Finger Paint'}
                    onChange={() => setCurrentFont('Finger Paint')}
                  />
                  <span className="ml-2 text-[var(--text-muted)] font-finger">Finger Paint</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="font"
                    value="Bungee Inline"
                    checked={currentFont === 'Bungee Inline'}
                    onChange={() => setCurrentFont('Bungee Inline')}
                  />
                  <span className="ml-2 text-[var(--text-muted)] font-bungee">Bungee</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="font"
                    value="Permanent Marker"
                    checked={currentFont === 'Permanent Marker'}
                    onChange={() => setCurrentFont('Permanent Marker')}
                  />
                  <span className="ml-2 text-[var(--text-muted)] font-marker">Marker</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="font"
                    value="Mystery Quest"
                    checked={currentFont === 'Mystery Quest'}
                    onChange={() => setCurrentFont('Mystery Quest')}
                  />
                  <span className="ml-2 text-[var(--text-muted)] font-mystery">Mystery</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="font"
                    value="Mountains of Christmas"
                    checked={currentFont === 'Mountains of Christmas'}
                    onChange={() => setCurrentFont('Mountains of Christmas')}
                  />
                  <span className="ml-2 text-[var(--text-muted)] font-mountains">Christmas</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="font"
                    value="Patrick Hand"
                    checked={currentFont === 'Patrick Hand'}
                    onChange={() => setCurrentFont('Patrick Hand')}
                  />
                  <span className="ml-2 text-[var(--text-muted)] font-patrick">Handwritten</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="font"
                    value="Rye"
                    checked={currentFont === 'Rye'}
                    onChange={() => setCurrentFont('Rye')}
                  />
                  <span className="ml-2 text-[var(--text-muted)] font-rye">Western</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 accent-[var(--primary-color)]"
                    name="font"
                    value="Rock Salt"
                    checked={currentFont === 'Rock Salt'}
                    onChange={() => setCurrentFont('Rock Salt')}
                  />
                  <span className="ml-2 text-[var(--text-muted)] font-rocksalt">Grungy</span>
                </label>
              </div>
            </div>

          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;