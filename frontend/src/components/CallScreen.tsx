"use client";
import React, { useState } from 'react';
import { MicrophoneIcon, VideoCameraIcon, HandRaisedIcon, FaceSmileIcon, PhoneIcon } from '@heroicons/react/24/outline';
import UserCard from './UserCard';
import FloatingUserCard from './FloatingUserCard';
import ExitConfirmationModal from './ExitConfirmationModal';

export default function CallScreen({ onEndCall, meetingCode, userName }: { onEndCall: () => void; meetingCode: string; userName: string }) {
  const users = [{ name: userName }];
  const otherUsers = []; // This would be populated with other participants in a real app
  const [showExitModal, setShowExitModal] = useState(false);

  const handleEndCallClick = () => {
    setShowExitModal(true);
  };

  const handleConfirmExit = () => {
    setShowExitModal(false);
    onEndCall();
  };

  return (
    <div className="bg-snow h-screen flex flex-col overflow-hidden">
      {/* Video Call Area */}
      <div className="flex-1 m-6 bg-gray-300 rounded-xl overflow-hidden">
        {users.length === 1 && otherUsers.length === 0 ? (
          // Single user - full screen
          <div className="h-full w-full">
            <UserCard name={users[0].name} isFullHeight={true} />
          </div>
        ) : (
          // Multiple users - main video with floating overlay
          <div className="relative h-full bg-gray-300 rounded-xl overflow-hidden">
            {/* Main video area (would show other person's video) */}
            <div className="h-full w-full bg-gray-400 rounded-xl flex items-center justify-center">
              <p className="text-gray-600 text-2xl">Other participant's video</p>
            </div>
            
            {/* Floating user card */}
            <FloatingUserCard name={userName} />
          </div>
        )}
      </div>

      {/* Bottom UI Controls */}
      <div className="bg-snow p-6">
        <div className="flex items-center justify-between">
          {/* Left Side: Time and Title */}
          <div className="flex items-center space-x-4">
            <span className="font-normal text-lg text-eel">10:30</span>
            <span className="font-semibold text-lg text-eel">{meetingCode}</span>
          </div>

          {/* Center: Main Controls */}
          <div className="absolute left-1/2 -translate-x-1/2">
             <button className="bg-feather-green p-4 rounded-full transition-colors duration-300">
                <MicrophoneIcon className="h-8 w-8 text-snow" />
             </button>
          </div>

          {/* Right Side: Other Controls */}
          <div className="flex items-center space-x-3">
            <button className="bg-eel/20 p-3 rounded-full hover:bg-eel/30 transition-colors duration-300">
              <VideoCameraIcon className="h-6 w-6 text-eel" />
            </button>
            <button className="bg-eel/20 p-3 rounded-full hover:bg-eel/30 transition-colors duration-300">
              <FaceSmileIcon className="h-6 w-6 text-eel" />
            </button>
            <button className="bg-eel/20 p-3 rounded-full hover:bg-eel/30 transition-colors duration-300">
              <HandRaisedIcon className="h-6 w-6 text-eel" />
            </button>
            <button
              onClick={handleEndCallClick}
              className="bg-red-600 p-3 rounded-full hover:bg-red-700 transition-colors duration-300 ml-4"
            >
              <PhoneIcon className="h-6 w-6 text-snow" />
            </button>
          </div>
        </div>
      </div>

      <ExitConfirmationModal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        onConfirm={handleConfirmExit}
      />
    </div>
  );
}
