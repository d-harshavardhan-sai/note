import { createContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import axios from "axios";

export const AppContent = createContext();

export const AppContextProvider = (props) => {
  // ✅ Set axios to send cookies with requests
  axios.defaults.withCredentials = true;

  // Use PORT from Auth project's .env for frontend
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);

  // New states for theme and font
  const [currentTheme, setCurrentTheme] = useState(() => {
    // Initialize from localStorage or default to 'light'
    return localStorage.getItem('appTheme') || 'light';
  });

  const [currentFont, setCurrentFont] = useState(() => {
    // Initialize from localStorage or default to 'Poppins'
    return localStorage.getItem('appFont') || 'Poppins';
  });

  const getAuthState = async () => {
    try {
      const { data } = await axios.get(backendUrl + "/api/auth/is-auth");
      if (data.success) {
        setIsLoggedIn(true);

        const res = await axios.post(backendUrl + "/api/user/data", {});
        if (res.data.success) {
          setUserData({ ...res.data.userData, _id: data.userId });
        } else {
          toast.error(res.data.message);
        }
      } else {
        setIsLoggedIn(false);
        setUserData(null);
      }
    } catch (error) {
      console.error("Error in getAuthState:", error);
      setIsLoggedIn(false);
      setUserData(null);
    }
  };

  const getUserData = async () => {
    try {
      const { data } = await axios.post(backendUrl + "/api/user/data", {});
      if (data.success) {
        setUserData(data.userData);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error("Error in getUserData:", error);
      toast.error(error.message);
    }
  };

  // Effect to save theme to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('appTheme', currentTheme);
    document.documentElement.className = ''; // Clear existing theme classes
    document.documentElement.classList.add(currentTheme); // Add new theme class
  }, [currentTheme]);

  // Effect to save font to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('appFont', currentFont);
    document.documentElement.style.setProperty('--primary-font', `"${currentFont}", sans-serif`);
  }, [currentFont]);


  useEffect(() => {
    getAuthState();
  }, []);

  const value = {
    backendUrl,

    isLoggedIn,
    setIsLoggedIn,

    userData,
    setUserData,

    getUserData,

    // New theme and font properties
    currentTheme,
    setCurrentTheme,
    currentFont,
    setCurrentFont,
  };
  return (
    <AppContent.Provider value={value}>
      {props.children}
    </AppContent.Provider>
  );
};