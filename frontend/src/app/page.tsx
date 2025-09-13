// src/app/page.tsx
"use client";
import React, { useState } from 'react';
import JoinScreen from '../components/JoinScreen';
import CallScreen from '../components/CallScreen';
import SummaryScreen from '../components/SummaryScreen';

export default function Home() {
  // State to manage which screen is currently visible
  const [screen, setScreen] = useState('join'); // Can be 'join', 'call', or 'summary'

  // Handlers to switch between screens
  const handleJoin = () => setScreen('call');
  const handleEndCall = () => setScreen('summary');
  const handleRestart = () => setScreen('join');

  // Render the correct component based on the current state
  const renderScreen = () => {
    switch (screen) {
      case 'join':
        return <JoinScreen onJoin={handleJoin} />;
      case 'call':
        return <CallScreen onEndCall={handleEndCall} />;
      case 'summary':
        return <SummaryScreen onRestart={handleRestart} />;
      default:
        return <JoinScreen onJoin={handleJoin} />;
    }
  };

  return (
    <main>
      {renderScreen()}
    </main>
  );
}
