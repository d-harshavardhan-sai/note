import { useState, useEffect, useContext } from "react";
import Navbar from "../components/Navbar";
import RateLimitedUI from "../components/RateLimitedUI";
import api from "../lib/axios";
import { toast } from "react-toastify";
import NoteCard from "../components/NoteCard";
import NotesNotFound from "../components/NotesNotFound";
import { AppContent } from "../context/AppContext";
import Header from "../components/Header";
import ProfilePicturePlaceholder from "../components/ProfilePicturePlaceholder"; // <-- NEW IMPORT

const HomePage = () => {
  const { isLoggedIn, userData, backendUrl, getUserData } = useContext(AppContent);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotes = async () => {
      if (!isLoggedIn) {
        setLoading(false);
        setNotes([]);
        return;
      }
      try {
        const res = await api.get("/notes");
        setNotes(res.data);
        setIsRateLimited(false);
      } catch (error) {
        console.error("Error fetching notes:", error);
        if (error.response?.status === 429) {
          setIsRateLimited(true);
        } else if (error.response?.status === 401 || error.response?.status === 403) {
          setNotes([]);
          setIsRateLimited(false);
        } else {
          toast.error("Failed to load notes");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, [isLoggedIn, userData]);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Display Header (Auth project's landing page banner) if NOT logged in */}
      {!isLoggedIn && (
        <Header />
      )}

      {isRateLimited && <RateLimitedUI />}

      <div className="max-w-7xl mx-auto p-4 mt-6">
        {loading && <div className="text-center text-[var(--primary-color)] py-10">Loading notes...</div>}

        {!loading && !isRateLimited && (
          isLoggedIn ? (
            notes.length === 0 ? (
              // --- UPDATED RENDERING LOGIC ---
              <ProfilePicturePlaceholder /> // Show profile picture when logged in but no notes
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {notes.map((note) => (
                  <NoteCard key={note._id} note={note} setNotes={setNotes} />
                ))}
              </div>
            )
          ) : (
            // If not logged in, show NotesNotFound (which acts as a login prompt)
            <NotesNotFound />
          )
        )}
      </div>
    </div>
  );
};
export default HomePage;