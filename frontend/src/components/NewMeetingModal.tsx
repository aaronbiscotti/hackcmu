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
    <Modal isOpen={isOpen} onClose={onClose} title="New Meeting">
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ marginBottom: '1rem' }}>New Meeting Created</h3>
        <p style={{ marginBottom: '1.5rem' }}>
          Share this code with others to join your meeting
        </p>
        
        <div className="sunken-panel" style={{ 
          padding: '1.5rem', 
          marginBottom: '1.5rem',
          textAlign: 'center'
        }}>
          <div style={{ 
            fontSize: '32px', 
            fontFamily: 'monospace', 
            letterSpacing: '0.2em',
            marginBottom: '1rem',
            fontWeight: 'bold'
          }}>
            {meetingCode}
          </div>
          <button onClick={handleCopyCode} style={{ 
            marginTop: '0.5rem',
            padding: '8px 16px',
            fontSize: '14px'
          }}>
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button onClick={handleJoinMeeting} style={{ 
            width: '100%',
            padding: '12px 16px',
            fontSize: '16px'
          }}>
            Join Meeting Now
          </button>
          <button onClick={onClose} style={{ 
            width: '100%',
            padding: '12px 16px',
            fontSize: '16px'
          }}>
            Share Code Later
          </button>
        </div>
      </div>
    </Modal>
  );
}