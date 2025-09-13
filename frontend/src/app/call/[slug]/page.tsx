"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CallScreen } from '../../../components/CallScreen';

export default function CallPage() {
  const params = useParams();
  const meetingCode = params.slug as string;
  const [userName, setUserName] = useState('User');

  useEffect(() => {
    const storedName = localStorage.getItem('userName');
    if (storedName) {
      setUserName(storedName);
    }
  }, []);

  const handleEndCall = () => {
    localStorage.removeItem('userName');
    window.location.href = '/summary';
  };

  return (
    <main>
      <CallScreen 
        onEndCall={handleEndCall} 
        meetingCode={meetingCode} 
        userName={userName}
        roomName={meetingCode}
        participantName={userName}
        backendUrl="http://127.0.0.1:8001"
      />
    </main>
  );
}
