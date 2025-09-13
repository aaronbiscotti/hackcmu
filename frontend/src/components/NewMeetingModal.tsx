"use client";
import React, { useEffect, useState } from 'react';
import { ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline';
import Modal from './Modal';

interface NewMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (code: string) => void;
}

export default function NewMeetingModal({ isOpen, onClose, onJoin }: NewMeetingModalProps) {
  const [meetingCode, setMeetingCode] = useState('');
  const [copied, setCopied] = useState(false);

  const generateMeetingCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  useEffect(() => {
    if (isOpen) {
      setMeetingCode(generateMeetingCode());
      setCopied(false);
    }
  }, [isOpen]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(meetingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleJoinMeeting = () => {
    onJoin(meetingCode);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="text-center">
        <h2 className="text-3xl font-bold text-feather-green mb-2 font-display">
          New Meeting Created
        </h2>
        <p className="text-eel/70 mb-8">
          Share this code with others to join your meeting
        </p>
        
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="text-4xl font-bold text-eel font-mono tracking-widest mb-4">
            {meetingCode}
          </div>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-2 mx-auto px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors duration-200"
          >
            {copied ? (
              <>
                <CheckIcon className="h-4 w-4 text-feather-green" />
                <span className="text-feather-green font-medium">Copied!</span>
              </>
            ) : (
              <>
                <ClipboardIcon className="h-4 w-4 text-eel" />
                <span className="text-eel">Copy Code</span>
              </>
            )}
          </button>
        </div>
        
        <div className="space-y-4">
          <button
            onClick={handleJoinMeeting}
            className="w-full bg-feather-green text-snow font-medium py-3 px-6 rounded-lg hover:bg-mask-green transition-colors duration-200"
          >
            Join Meeting Now
          </button>
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-eel font-medium py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors duration-200"
          >
            Share Code Later
          </button>
        </div>
      </div>
    </Modal>
  );
}