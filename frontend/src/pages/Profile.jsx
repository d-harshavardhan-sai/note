import React, { useContext, useState, useEffect } from 'react';
import { AppContent } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import Navbar from '../components/Navbar';
import zxcvbn from 'zxcvbn';
import { assets } from '../assets/assets';

const Profile = () => {
  const navigate = useNavigate();
  const { userData, backendUrl, setUserData, setIsLoggedIn } = useContext(AppContent);

  const [name, setName] = useState('');
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(assets.person);
  const [isProfileUpdating, setIsProfileUpdating] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);

  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordFeedback, setPasswordFeedback] = useState("");
  const [passwordWarning, setPasswordWarning] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationPassword, setDeleteConfirmationPassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);


  useEffect(() => {
    if (userData) {
      setName(userData.name || '');
      setProfilePicturePreview(userData.profilePicture || assets.person);
    } else {
      toast.info("Please log in to view your profile.");
      navigate('/login');
    }
  }, [userData, navigate]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePictureFile(file);
      setProfilePicturePreview(URL.createObjectURL(file));
    } else {
      setProfilePictureFile(null);
      setProfilePicturePreview(userData?.profilePicture || assets.person);
    }
  };

  const handleNewPasswordChange = (e) => {
    const password = e.target.value;
    setNewPassword(password);
    if (password.length > 0) {
      const result = zxcvbn(password);
      setPasswordStrength(result.score);
      setPasswordFeedback(result.feedback.suggestions.join(" ") || "");
      setPasswordWarning(result.feedback.warning || "");
    } else {
      setPasswordStrength(0);
      setPasswordFeedback("");
      setPasswordWarning("");
    }
  };

  const getStrengthBarColor = (score) => {
    switch (score) {
      case 0: return "bg-red-500";
      case 1: return "bg-orange-500";
      case 2: return "bg-yellow-500";
      case 3: return "bg-blue-500";
      case 4: return "bg-green-500";
      default: return "bg-gray-300";
    }
  };

  const getStrengthText = (score) => {
    switch (score) {
      case 0: return "Very Weak";
      case 1: return "Weak";
      case 2: return "Fair";
      case 3: return "Good";
      case 4: return "Strong";
      default: return "";
    }
  };


  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setIsProfileUpdating(true);
    try {
      axios.defaults.withCredentials = true;

      const formData = new FormData();
      formData.append('userId', userData._id);
      formData.append('name', name);
      if (profilePictureFile) {
        formData.append('profilePicture', profilePictureFile);
      } else if (profilePicturePreview === assets.person && userData.profilePicture) {
        formData.append('profilePicture', '');
      }

      const response = await axios.post(`${backendUrl}/api/user/update-profile`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        toast.success(response.data.message);
        setUserData(prev => ({
            ...prev,
            name: response.data.userData.name,
            profilePicture: response.data.userData.profilePicture
        }));
        setProfilePictureFile(null);
        setProfilePicturePreview(response.data.userData.profilePicture || assets.person);
        navigate('/');
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(error.response?.data?.message || "An error occurred while updating profile.");
    } finally {
      setIsProfileUpdating(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setIsPasswordChanging(true);
    try {
      if (newPassword !== confirmNewPassword) {
        toast.error("New password and confirm password do not match.");
        return;
      }
      if (passwordStrength < 2) {
        toast.error("Please choose a stronger new password.");
        return;
      }

      axios.defaults.withCredentials = true;
      const response = await axios.post(`${backendUrl}/api/user/change-password`, {
        userId: userData._id,
        currentPassword,
        newPassword
      });

      if (response.data.success) {
        toast.success(response.data.message);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setPasswordStrength(0);
        setPasswordFeedback("");
        setPasswordWarning("");
        navigate('/');
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error("Error changing password:", error);
      toast.error(error.response?.data?.message || "An error occurred while changing password.");
    } finally {
      setIsPasswordChanging(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      axios.defaults.withCredentials = true;
      const response = await axios.post(`${backendUrl}/api/user/delete-account`, {
        userId: userData._id,
        currentPassword: deleteConfirmationPassword,
      });

      if (response.data.success) {
        toast.success(response.data.message);
        setIsLoggedIn(false);
        setUserData(null);
        navigate('/');
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error(error.response?.data?.message || "An error occurred during account deletion.");
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteModal(false);
      setDeleteConfirmationPassword('');
    }
  };


  if (!userData) {
    return <div className="flex justify-center items-center min-h-screen">Loading profile...</div>;
  }

  return (
    <div className='flex flex-col items-center min-h-screen'>
      <Navbar />
      <div className="flex flex-col items-center justify-center pt-24 pb-10 w-full max-w-lg mx-auto px-4">
        <h1 className="text-3xl font-semibold text-purple-600 mb-8">My Profile</h1>

        {/* Profile Information Section */}
        <div className="bg-white p-8 rounded-lg shadow-lg w-full mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Update Profile Information</h2>
          <div className="flex flex-col items-center mb-6">
            <img
              src={profilePicturePreview}
              alt="Profile"
              className="w-24 h-24 rounded-full object-cover border-4 border-purple-600"
            />
            <p className="text-lg mt-2 text-gray-600">{userData.email}</p>
          </div>

          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-gray-700 font-medium mb-2">Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-600 focus:border-purple-600"
                autoComplete="name"
                required
              />
            </div>
            <div>
              <label htmlFor="profilePicture" className="block text-gray-700 font-medium mb-2">Profile Picture</label>
              <input
                type="file"
                id="profilePicture"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full p-3 border border-gray-300 rounded-md file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                autoComplete="off"
              />
            </div>
            {profilePicturePreview && profilePicturePreview !== assets.person && (
                <button
                    type="button"
                    onClick={() => {
                        setProfilePictureFile(null);
                        setProfilePicturePreview(assets.person);
                    }}
                    className="text-sm ml-auto block text-red-500 hover:underline"
                >
                    Clear Profile Picture
                </button>
            )}
            <button
              type="submit"
              className="bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 w-full py-2.5 rounded-full text-white font-semibold flex items-center justify-center"
              disabled={isProfileUpdating}
            >
              {isProfileUpdating ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                "Update Profile"
              )}
            </button>
          </form>
        </div>

        {/* Change Password Section */}
        <div className="bg-white p-8 rounded-lg shadow-lg w-full mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Change Password</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-gray-700 font-medium mb-2">Current Password</label>
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-600 focus:border-purple-600"
                autoComplete="current-password"
                required
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-gray-700 font-medium mb-2">New Password</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={handleNewPasswordChange}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-600 focus:border-purple-600"
                autoComplete="new-password"
                required
              />
              {/* Password Strength Meter */}
              {newPassword.length > 0 && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`${getStrengthBarColor(passwordStrength)} h-2.5 rounded-full`}
                      style={{ width: `${(passwordStrength + 1) * 20}%` }}
                    ></div>
                  </div>
                  <p className={`text-xs mt-1 ${getStrengthBarColor(passwordStrength).replace('bg', 'text')}`}>
                    Strength: {getStrengthText(passwordStrength)}
                  </p>
                  {passwordWarning && (
                    <p className="text-red-300 text-xs mt-1">
                      Warning: {passwordWarning}
                    </p>
                  )}
                  {passwordFeedback && (
                    <p className="text-gray-300 text-xs mt-1">
                      Suggestions: {passwordFeedback}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div>
              <label htmlFor="confirmNewPassword" className="block text-gray-700 font-medium mb-2">Confirm New Password</label>
              <input
                type="password"
                id="confirmNewPassword"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-600 focus:border-purple-600"
                autoComplete="new-password"
                required
              />
            </div>
            <button
              type="submit"
              className="bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 w-full py-2.5 rounded-full text-white font-semibold flex items-center justify-center"
              disabled={isPasswordChanging}
            >
              {isPasswordChanging ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                "Change Password"
              )}
            </button>
          </form>
        </div>

        {/* Delete Account Section */}
        <div className="bg-red-100 p-8 rounded-lg shadow-lg w-full border border-red-300">
          <h2 className="text-2xl font-semibold text-red-700 mb-6 text-center">Danger Zone</h2>
          <p className="text-red-600 mb-4 text-center">
            Deleting your account is permanent and cannot be undone. All your data will be removed.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="bg-red-600 hover:bg-red-700 w-full py-2.5 rounded-full text-white font-semibold transition-all"
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-sm text-center">
            <h3 className="text-xl font-bold text-red-600 mb-4">Confirm Account Deletion</h3>
            <p className="text-gray-700 mb-6">
              This action is permanent. To confirm, please enter your password:
            </p>
            <input
              type="password"
              className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:ring-red-500 focus:border-red-500"
              placeholder="Your Password"
              value={deleteConfirmationPassword}
              onChange={(e) => setDeleteConfirmationPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-6 py-2 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100 transition-all"
                disabled={isDeletingAccount}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-full text-white font-semibold flex items-center justify-center"
                disabled={isDeletingAccount}
              >
                {isDeletingAccount ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  "Delete My Account"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;