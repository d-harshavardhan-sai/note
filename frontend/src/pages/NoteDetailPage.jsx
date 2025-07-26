import { useEffect, useState, useContext } from "react"; // Added useContext
import { Link, useNavigate, useParams } from "react-router-dom"; // Changed from react-router to react-router-dom
import api from "../lib/axios";
import { toast } from "react-toastify"; // Changed from react-hot-toast to react-toastify
import { ArrowLeftIcon, LoaderIcon, Trash2Icon } from "lucide-react";
import { AppContent } from "../context/AppContext"; // Import AppContent

const NoteDetailPage = () => {
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();
  const { id } = useParams();
  const { isLoggedIn, userData } = useContext(AppContent); // Get auth state

  // Redirect if not logged in
  if (!isLoggedIn) {
    toast.error("You must be logged in to view notes.");
    navigate("/login");
    return null; // Render nothing if redirecting
  }

  useEffect(() => {
    const fetchNote = async () => {
      try {
        const res = await api.get(`/notes/${id}`);
        // Frontend check for ownership as well (defense in depth)
        if (res.data.owner !== userData._id) {
          toast.error("You do not have permission to view this note.");
          navigate("/"); // Redirect to home page
          return;
        }
        setNote(res.data);
      } catch (error) {
        console.error("Error in fetching note", error); // Changed console.log to console.error
        if (error.response?.status === 401) {
          toast.error("Unauthorized: Please log in.");
          navigate("/login");
        } else if (error.response?.status === 403) {
          toast.error("Forbidden: You do not own this note.");
          navigate("/");
        } else if (error.response?.status === 404) {
          toast.error("Note not found.");
          navigate("/"); // Go back to notes list
        } else {
          toast.error("Failed to fetch the note");
        }
      } finally {
        setLoading(false);
      }
    };

    if (userData) { // Only fetch if user data is loaded (means logged in)
      fetchNote();
    }
  }, [id, userData, navigate]); // Depend on id and userData


  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this note?")) return;

    if (!userData || note.owner !== userData._id) {
      toast.error("You can only delete your own notes.");
      return;
    }

    try {
      await api.delete(`/notes/${id}`);
      toast.success("Note deleted");
      navigate("/");
    } catch (error) {
      console.error("Error deleting the note:", error); // Changed console.log to console.error
      if (error.response?.status === 403) {
        toast.error("Forbidden: You can only delete your own notes.");
      } else if (error.response?.status === 401) {
        toast.error("Unauthorized: Please log in.");
        navigate("/login");
      } else {
        toast.error("Failed to delete note");
      }
    }
  };

  const handleSave = async () => {
    if (!note.title.trim() || !note.content.trim()) {
      toast.error("Please add a title or content");
      return;
    }

    if (!userData || note.owner !== userData._id) {
      toast.error("You can only edit your own notes.");
      return;
    }

    setSaving(true);

    try {
      await api.put(`/notes/${id}`, note);
      toast.success("Note updated successfully");
      navigate("/");
    } catch (error) {
      console.error("Error saving the note:", error); // Changed console.log to console.error
      if (error.response?.status === 403) {
        toast.error("Forbidden: You can only edit your own notes.");
      } else if (error.response?.status === 401) {
        toast.error("Unauthorized: Please log in.");
        navigate("/login");
      } else {
        toast.error("Failed to update note");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading || !note) { // Show loading until note data is fetched
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <LoaderIcon className="animate-spin size-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link to="/" className="btn btn-ghost">
              <ArrowLeftIcon className="h-5 w-5" />
              Back to Notes
            </Link>
            {/* Show delete button only if current user owns the note */}
            {userData && note.owner === userData._id && (
              <button onClick={handleDelete} className="btn btn-error btn-outline">
                <Trash2Icon className="h-5 w-5" />
                Delete Note
              </button>
            )}
          </div>

          <div className="card bg-base-100">
            <div className="card-body">
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Title</span>
                </label>
                <input
                  type="text"
                  placeholder="Note title"
                  className="input input-bordered"
                  value={note.title}
                  onChange={(e) => setNote({ ...note, title: e.target.value })}
                  disabled={userData && note.owner !== userData._id} // Disable if not owner
                />
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Content</span>
                </label>
                <textarea
                  placeholder="Write your note here..."
                  className="textarea textarea-bordered h-32"
                  value={note.content}
                  onChange={(e) => setNote({ ...note, content: e.target.value })}
                  disabled={userData && note.owner !== userData._id} // Disable if not owner
                />
              </div>

              <div className="card-actions justify-end">
                {userData && note.owner === userData._id && ( // Show save button only if owner
                  <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default NoteDetailPage;