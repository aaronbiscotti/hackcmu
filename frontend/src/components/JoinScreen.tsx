"use client";
import React from 'react';
import Navbar from './Navbar';
import TimeDisplay from './TimeDisplay';
import HeaderSection from './HeaderSection';
import JoinForm from './JoinForm';

export default function JoinScreen({ onJoin }: { onJoin: () => void }) {
  return (
    <div style={{ padding: '2rem', minHeight: '100vh', position: 'relative' }}>
      <div className="window" style={{ width: '100%', height: 'calc(100vh - 4rem)', position: 'relative' }}>
        <div className="title-bar">
          <div className="title-bar-text">Totter - Video Calls</div>
          <div className="title-bar-controls">
            <button aria-label="Minimize"></button>
            <button aria-label="Maximize"></button>
            <button aria-label="Close"></button>
          </div>
        </div>
        <div className="window-body" style={{ padding: '1rem', height: 'calc(100% - 30px)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexShrink: 0 }}>
              <div style={{ fontSize: '12px', fontFamily: "'VT323', monospace" }}>Totter</div>
              <TimeDisplay />
            </div>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <HeaderSection />
              <JoinForm onJoin={onJoin} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
