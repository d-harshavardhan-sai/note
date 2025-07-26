import { NotebookIcon } from "lucide-react";
import { Link } from "react-router-dom"; // Changed from react-router to react-router-dom
import { useContext } from "react";
import { AppContent } from "../context/AppContext";

const NotesNotFound = () => {
  const { isLoggedIn } = useContext(AppContent);

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6 max-w-md mx-auto text-center">
      <div className="bg-primary/10 rounded-full p-8">
        <NotebookIcon className="size-10 text-primary" />
      </div>
      <h3 className="text-2xl font-bold">
        {isLoggedIn ? "No notes yet" : "Welcome to ThinkBoard!"}
      </h3>
      <p className="text-base-content/70">
        {isLoggedIn
          ? "Ready to organize your thoughts? Create your first note to get started on your journey."
          : "Please log in or register to start creating your personal notes."}
      </p>
      {isLoggedIn ? (
        <Link to="/create" className="btn btn-primary">
          Create Your First Note
        </Link>
      ) : (
        <Link to="/login" className="btn btn-primary">
          Login / Register
        </Link>
      )}
    </div>
  );
};
export default NotesNotFound;