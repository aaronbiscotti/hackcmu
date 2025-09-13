"use client";
import React from 'react';
import Navbar from './Navbar';
import TimeDisplay from './TimeDisplay';
import HeaderSection from './HeaderSection';
import JoinForm from './JoinForm';

export default function JoinScreen({ onJoin }: { onJoin: () => void }) {
  return (
    <div className="bg-snow min-h-screen">
      <div className="flex justify-between items-start">
        <Navbar />
        <div className="p-6">
          <TimeDisplay />
        </div>
      </div>
      
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-6">
        <div className="max-w-2xl mx-auto w-full">
          <HeaderSection />
          <JoinForm onJoin={onJoin} />
        </div>
      </div>
    </div>
  );
}
