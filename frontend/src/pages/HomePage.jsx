import { useState, useEffect, useContext } from "react"; // Added useContext
import Navbar from "../components/Navbar";
import RateLimitedUI from "../components/RateLimitedUI";
import api from "../lib/axios";
import { toast } from "react-toastify"; // Changed from react-hot-toast to react-toastify
import NoteCard from "../components/NoteCard";
import NotesNotFound from "../components/NotesNotFound";
import { AppContent } from "../context/AppContext"; // Import AppContent
import Header from "../components/Header"; // Import the Header component from auth project

const HomePage = () => {
  const { isLoggedIn, userData, backendUrl, getUserData } = useContext(AppContent); // Get auth state
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch notes only if logged in
  useEffect(() => {
    const fetchNotes = async () => {
      if (!isLoggedIn) { // Only fetch if user is logged in
        setLoading(false);
        setNotes([]); // Clear notes if logged out
        return;
      }
      try {
        const res = await api.get("/notes"); // This endpoint is now protected
        setNotes(res.data);
        setIsRateLimited(false);
      } catch (error) {
        console.error("Error fetching notes:", error); // Changed console.log to console.error
        if (error.response?.status === 429) {
          setIsRateLimited(true);
        } else if (error.response?.status === 401 || error.response?.status === 403) {
          // If unauthorized, clear notes and don't show error (expected if not logged in)
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
  }, [isLoggedIn, userData]); // Re-fetch when login status or userData changes

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Display Header (from Auth project) if not logged in, or no notes are loaded yet */}
      {!isLoggedIn && (
        <Header />
      )}

      {/* Show Rate Limited UI if applicable */}
      {isRateLimited && <RateLimitedUI />}

      <div className="max-w-7xl mx-auto p-4 mt-6">
        {loading && <div className="text-center text-primary py-10">Loading notes...</div>}

        {/* Display notes or NotFound/Login prompt */}
        {!loading && !isRateLimited && (
          isLoggedIn ? (
            notes.length === 0 ? (
              <NotesNotFound />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {notes.map((note) => (
                  <NoteCard key={note._id} note={note} setNotes={setNotes} />
                ))}
              </div>
            )
          ) : (
            // If not logged in, show NotesNotFound as a login prompt
            <NotesNotFound />
          )
        )}
      </div>
    </div>
  );
};
export default HomePage;