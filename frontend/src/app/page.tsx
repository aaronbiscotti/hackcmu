// src/app/page.tsx
"use client";
import React from 'react';
import JoinScreen from '../components/JoinScreen';

export default function Home() {
  // This function is a placeholder as JoinForm handles the navigation.
  const handleJoin = () => {
    // The actual navigation is handled inside JoinForm.tsx
    console.log("Joining call...");
  };

  return (
    <main>
      <JoinScreen onJoin={handleJoin} />
    </main>
  );
}
