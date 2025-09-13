// src/components/SummaryScreen.tsx
"use client";
import React from 'react';

const MetricCard = ({ title, value, recommendation }: { title: string, value: string, recommendation: string }) => (
  <div className="sunken-panel" style={{ padding: '8px', backgroundColor: '#e0e0e0' }}>
    <h3 style={{ fontWeight: 'bold', color: '#000', marginBottom: '4px' }}>{title}</h3>
    <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#000080', marginBottom: '4px' }}>{value}</p>
    <p style={{ fontSize: '11px', color: '#666' }}>{recommendation}</p>
  </div>
);

export default function SummaryScreen({ onRestart }: { onRestart: () => void }) {
  return (
    <div style={{ 
      backgroundColor: 'white', 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '2rem' 
    }}>
      <div className="window" style={{ width: '100%', maxWidth: '600px' }}>
        <div className="title-bar">
          <div className="title-bar-text">Post Game Summary</div>
          <div className="title-bar-controls">
            <button aria-label="Minimize"></button>
            <button aria-label="Maximize"></button>
            <button aria-label="Close"></button>
          </div>
        </div>
        <div className="window-body" style={{ padding: '1rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#000', marginBottom: '1rem' }}>
            📊 Meeting Analysis Complete
          </h1>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '8px', 
            textAlign: 'left',
            marginBottom: '1rem'
          }}>
            <MetricCard title="🏃 Speed" value="150 WPM" recommendation="Slightly fast. Try pausing between key points." />
            <MetricCard title="🗣️ Clarity" value="Good" recommendation="Your articulation was clear and consistent." />
            <MetricCard title="🤔 Filler Words" value="8 words" recommendation="Used 'um' and 'like' occasionally." />
            <MetricCard title="🎵 Inflection" value="Dynamic" recommendation="Great vocal variety kept the talk engaging." />
            <MetricCard title="🔊 Volume" value="Consistent" recommendation="Your volume was steady and easy to hear." />
          </div>
          <button
            onClick={onRestart}
            style={{ 
              padding: '8px 16px',
              fontSize: '14px',
              backgroundColor: '#008000',
              color: 'white',
              minWidth: '150px'
            }}
          >
            🔄 Start Another Call
          </button>
        </div>
      </div>
    </div>
  );
}
