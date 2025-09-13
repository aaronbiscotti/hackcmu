"use client";
import React from 'react';
import Navbar from './Navbar';
import TimeDisplay from './TimeDisplay';
import HeaderSection from './HeaderSection';
import JoinForm from './JoinForm';

export default function JoinScreen({ onJoin }: { onJoin: () => void }) {
  return (
    <div className="bg-snow h-screen flex flex-col">
      <div className="flex justify-between items-start flex-shrink-0">
        <Navbar />
        <div className="p-6">
          <TimeDisplay />
        </div>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-2xl mx-auto w-full">
          <HeaderSection />
          <JoinForm onJoin={onJoin} />
        </div>
      </div>
    </div>
  );
}
