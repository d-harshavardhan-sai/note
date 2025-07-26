import React, { useContext } from 'react'
import { assets } from '../assets/assets.js'
import { AppContent } from '../context/AppContext.jsx'
import { useNavigate } from 'react-router-dom'; // Added useNavigate

const Header = () => {
  const navigate = useNavigate(); // Initialize useNavigate
  const {userData} = useContext(AppContent)

  const headerImageSrc = (userData && userData.profilePicture)
                         ? userData.profilePicture
                         : assets.head;

  return (
    <div className='flex flex-col items-center mt-20 px-4 text-center text-general'>
        <img
          src={headerImageSrc}
          alt="Profile"
          className='w-26 h-36 rounded-full mb-6 object-cover header-profile-img'
        />
        <h1 className='flex items-center gap-2 text-xl sm:3xl text-purple-600 font-bold'>Hey {userData ? userData.name : 'Developer'} ! <img src={assets.hand} alt="" className='w-8 aspect-square'/> </h1>

        <h2 className='text-3xl sm:text-5xl font-semibold mb-4 text-pink-500'>Welcome to our app</h2>

        <p className='mb-8 max-w-md text-blue-400 font-bold'>How is the josh?.. I hope you are fully excited. Let's begin the process.. Be secure..</p>

        {/* Change Get Started button to navigate to notes creation if logged in, otherwise login */}
        {userData ? (
          <button
            onClick={() => navigate("/create")}
            className='border border-gray-500 rounded-full px-8 py-2.5 hover:bg-amber-100 text-violet-400 font-bold transition-all'
          >
            Get Started with Notes
          </button>
        ) : (
          <button
            onClick={() => navigate("/login")}
            className='border border-gray-500 rounded-full px-8 py-2.5 hover:bg-amber-100 text-violet-400 font-bold transition-all'
          >
            Get Started
          </button>
        )}
    </div>
  )
}

export default Header