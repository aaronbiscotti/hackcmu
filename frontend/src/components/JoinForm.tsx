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
      <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter meeting code"
            style={{ 
              width: '350px', 
              marginBottom: '1rem', 
              fontSize: '18px', 
              padding: '12px 16px',
              height: '50px',
              border: '2px inset #c0c0c0',
              backgroundColor: 'white',
              fontFamily: "'VT323', monospace"
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            type="button"
            onClick={handleNewMeeting}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              minWidth: '140px',
              height: '50px',
              backgroundColor: '#c0c0c0',
              border: '2px outset #c0c0c0',
              fontFamily: "'VT323', monospace",
              cursor: 'pointer'
            }}
          >
            New Meeting
          </button>
          <button
            type="submit"
            disabled={!isActive}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              minWidth: '100px',
              height: '50px',
              backgroundColor: isActive ? '#c0c0c0' : '#808080',
              border: isActive ? '2px outset #c0c0c0' : '2px inset #c0c0c0',
              fontFamily: "'VT323', monospace",
              cursor: isActive ? 'pointer' : 'not-allowed',
              color: isActive ? '#000' : '#666'
            }}
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
