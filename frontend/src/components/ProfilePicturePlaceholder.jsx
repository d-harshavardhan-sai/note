import React, { useContext } from 'react';
import { AppContent } from '../context/AppContext';
import { assets } from '../assets/assets';
import { Link } from 'react-router-dom'; // Assuming Link is from react-router-dom

const ProfilePicturePlaceholder = () => {
  const { userData } = useContext(AppContent);

  const profileImageSrc = (userData && userData.profilePicture)
                         ? userData.profilePicture
                         : assets.person; // Fallback to a default person icon

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6 max-w-md mx-auto text-center">
      {/* Floating Profile Picture */}
      <img
        src={profileImageSrc}
        alt="User Profile"
        className="w-32 h-32 rounded-full object-cover border-4 border-[var(--primary-color)] mb-6 header-profile-img"
        style={{ animationDuration: '4s' }} /* Adjust animation speed if needed */
      />

      {/* Message and Call to Action */}
      <h3 className="text-2xl font-bold text-[var(--primary-color)]">
        You don't have any notes yet!
      </h3>
      <p className="text-[var(--text-color)]">
        Ready to organize your thoughts? Create your first note to get started on your journey.
      </p>
      <Link to="/create" className="btn-base"> {/* Using btn-base for themed button x */}
        Create Your First Note
      </Link>
    </div>
  );
};

export default ProfilePicturePlaceholder;