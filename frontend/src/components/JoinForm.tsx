"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { VideoCameraIcon } from '@heroicons/react/24/outline';
import NewMeetingModal from './NewMeetingModal';
import ErrorToast from './ErrorToast';

interface JoinFormProps {
  onJoin: () => void;
}

export default function JoinForm({ onJoin }: JoinFormProps) {
  const router = useRouter();
  const [name] = useState('User'); // Default name, will be set in PreJoin
  const [code, setCode] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const showErrorToast = (message: string) => {
    setErrorMessage(message);
    setShowError(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      showErrorToast('Please enter a meeting code to join');
      return;
    }
    localStorage.setItem('userName', name); // Default name, will be updated in PreJoin
    router.push(`/call/${code.trim().toUpperCase()}`);
  };

  const handleNewMeeting = () => {
    setIsModalOpen(true);
  };

  const handleModalJoin = (meetingCode: string) => {
    setCode(meetingCode);
    localStorage.setItem('userName', name);
    router.push(`/call/${meetingCode}`);
  };

  const isActive = code.trim().length > 0;

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 w-full">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleNewMeeting}
            className="bg-feather-green text-snow p-4 rounded-lg hover:bg-mask-green transition-colors duration-200 flex items-center gap-2 px-6"
          >
            <VideoCameraIcon className="h-5 w-5" />
            New Meeting
          </button>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter meeting code"
            className="flex-1 px-6 py-4 bg-gray-100 text-eel placeholder-eel/50 border border-gray-200 rounded-lg focus:outline-none focus:border-feather-green"
          />
          <button
            type="submit"
            disabled={!isActive}
            className={`px-8 py-4 font-medium rounded-lg transition-colors duration-200 ${
              isActive
                ? 'bg-feather-green text-snow hover:bg-mask-green cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Join
          </button>
        </div>
      </form>

      <NewMeetingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onJoin={handleModalJoin}
      />

      <ErrorToast
        message={errorMessage}
        isVisible={showError}
        onClose={() => setShowError(false)}
      />
    </>
  );
}
