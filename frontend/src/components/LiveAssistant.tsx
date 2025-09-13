// frontend/src/components/LiveAssistant.tsx

import { useEffect, useState } from 'react';

// Assuming you have an animation component
// import { TalkingAnimation } from './TalkingAnimation';

interface LiveAssistantProps {
  transcript: string;
  isConnected: boolean;
}

export const LiveAssistant = ({ transcript, isConnected }: LiveAssistantProps) => {
  const [isTalking, setIsTalking] = useState(false);

  // A simple effect to show an animation briefly when new text arrives.
  useEffect(() => {
    if (transcript) {
      setIsTalking(true);
      // Reset the animation after a short period of silence.
      const timer = setTimeout(() => setIsTalking(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [transcript]); // This effect re-runs every time the transcript prop changes.

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '80px',
        left: '20px',
        color: 'white',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: '15px',
        borderRadius: '10px',
        fontFamily: 'sans-serif',
        maxWidth: '300px',
      }}
    >
      <h4 style={{ margin: 0, marginBottom: '5px' }}>
        Live Assistant Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </h4>
      {/* This is where you would place your talking animation component */}
      {/* {isTalking && <TalkingAnimation />} */}

      <p style={{ margin: 0, minHeight: '50px' }}>
        <strong>Transcript:</strong> {transcript || 'Listening...'}
      </p>
    </div>
  );
};