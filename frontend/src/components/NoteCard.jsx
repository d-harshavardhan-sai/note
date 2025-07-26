import { PenSquareIcon, Trash2Icon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom"; // Changed from react-router to react-router-dom
import { formatDate } from "../lib/utils";
import api from "../lib/axios";
import { toast } from "react-toastify"; // Changed from react-hot-toast to react-toastify
import { useContext } from "react";
import { AppContent } from "../context/AppContext"; // To get userId for ownership check

const NoteCard = ({ note, setNotes }) => {
  const navigate = useNavigate();
  const { userData } = useContext(AppContent);

  const handleDelete = async (e, id) => {
    e.preventDefault(); // get rid of the navigation behaviour from the parent Link

    if (!userData || !userData._id) {
      toast.error("You must be logged in to delete notes.");
      navigate("/login");
      return;
    }

    if (note.owner !== userData._id) {
      toast.error("You can only delete your own notes.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this note?")) return;

    try {
      await api.delete(`/notes/${id}`);
      setNotes((prev) => prev.filter((note) => note._id !== id));
      toast.success("Note deleted successfully");
    } catch (error) {
      console.error("Error in handleDelete", error);
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

  return (
    <Link
      to={`/note/${note._id}`}
      className="card bg-base-100 hover:shadow-lg transition-all duration-200 
      border-t-4 border-solid border-[#00FF9D]"
    >
      <div className="card-body">
        <h3 className="card-title text-base-content">{note.title}</h3>
        <p className="text-base-content/70 line-clamp-3">{note.content}</p>
        <div className="card-actions justify-between items-center mt-4">
          <span className="text-sm text-base-content/60">
            {formatDate(new Date(note.createdAt))}
          </span>
          <div className="flex items-center gap-1">
            {/* Removed the <Link> here as the whole card is already a link */}
            {/* Added text-primary to ensure icon color is themed */}
            <PenSquareIcon className="size-4 text-primary cursor-pointer" /> 
            
            {/* Show delete button only if logged in and it's their note */}
            {userData && note.owner === userData._id && (
              <button
                className="btn btn-ghost btn-xs text-error"
                onClick={(e) => handleDelete(e, note._id)}
              >
                <Trash2Icon className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};
export default NoteCard;