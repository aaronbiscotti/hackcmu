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
  const [name, setName] = useState('');
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
    if (!name.trim()) {
      showErrorToast('Please enter your name to join the meeting');
      return;
    }
    if (!code.trim()) {
      showErrorToast('Please enter a meeting code to join');
      return;
    }
    localStorage.setItem('userName', name.trim());
    router.push(`/call/${code.trim().toUpperCase()}`);
  };

  const handleNewMeeting = () => {
    if (!name.trim()) {
      showErrorToast('Please enter your name before creating a meeting');
      return;
    }
    setIsModalOpen(true);
  };

  const handleModalJoin = (meetingCode: string) => {
    setCode(meetingCode);
    localStorage.setItem('userName', name.trim());
    router.push(`/call/${meetingCode}`);
  };

  const isActive = name.trim().length > 0 && code.trim().length > 0;

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 w-full">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          className="w-full px-6 py-4 bg-gray-100 text-eel placeholder-eel/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-feather-green focus:border-transparent"
        />
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleNewMeeting}
            className="bg-feather-green text-snow p-4 rounded-full hover:bg-mask-green transition-colors duration-300 flex items-center gap-2 px-6"
          >
            <VideoCameraIcon className="h-5 w-5" />
            New Meeting
          </button>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter meeting code"
            className="flex-1 px-6 py-4 bg-gray-100 text-eel placeholder-eel/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-feather-green focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!isActive}
            className={`px-8 py-4 font-bold rounded-xl transition-all duration-300 ${
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
