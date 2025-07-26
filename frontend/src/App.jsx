import { Route, Routes } from "react-router-dom"; // Changed from react-router to react-router-dom for Route, Routes

import HomePage from "./pages/HomePage";
import CreatePage from "./pages/CreatePage";
import NoteDetailPage from "./pages/NoteDetailPage";

// Auth project imports
import Login from './pages/Login';
import EmailVerify from './pages/EmailVerify';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile';

const App = () => {
  return (
    // The main app wrapper. Background gradient is applied globally via body in index.css
    <div className="relative h-full w-full">
      {/* Removed old background div as theme background is global via index.css */}
      <Routes>
        {/* Auth Routes */}
        <Route path='/login' element={<Login/>}/>
        <Route path='/email-verify' element={<EmailVerify/>}/>
        <Route path='/reset-password' element={<ResetPassword/>}/>
        <Route path='/profile' element={<Profile/>}/>

        {/* Notes Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/note/:id" element={<NoteDetailPage />} />
      </Routes>
    </div>
  );
};
export default App;