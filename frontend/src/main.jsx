import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom"; // Changed from react-router to react-router-dom
import { Toaster } from "react-hot-toast"; // Keep react-hot-toast if you want its specific styling
// Auth project imports
import { AppContextProvider } from './context/AppContext.jsx';
import { ToastContainer } from 'react-toastify'; // react-toastify for auth notifications
import 'react-toastify/dist/ReactToastify.css';

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AppContextProvider> {/* Wrap App with AppContextProvider */}
        <App />
        {/* Keep react-hot-toast for existing notes notifications */}
        <Toaster /> 
        {/* Add react-toastify for auth notifications */}
        <ToastContainer position="top-center" autoClose={3000} /> 
      </AppContextProvider>
    </BrowserRouter>
  </StrictMode>
);