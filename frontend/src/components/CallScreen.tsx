// frontend/src/components/CallScreen.tsx

import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  VideoConference,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useEffect, useState } from 'react';
import { LiveAssistant } from './LiveAssistant';

// Define the structure of the transcript message we expect from the server
interface TranscriptMessage {
  type: 'partial' | 'final';
  transcript: string;
}

// Define the props interface for CallScreen
interface CallScreenProps {
  roomName?: string;
  participantName?: string;
  backendUrl?: string;
  meetingCode?: string;
  userName?: string;
  onEndCall?: () => void;
}

export const CallScreen = ({ roomName, participantName, backendUrl, meetingCode, userName }: CallScreenProps) => {
  const [token, setToken] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [latestTranscript, setLatestTranscript] = useState('');
  const [isWsConnected, setIsWsConnected] = useState(false);

  // Use the passed props or set defaults
  const effectiveRoomName = roomName || meetingCode || 'default-room';
  const effectiveParticipantName = participantName || userName || 'Anonymous';
  const effectiveBackendUrl = backendUrl || 'http://127.0.0.1:8001';

  // Step 1: Get the LiveKit token from your backend.
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(
          `${effectiveBackendUrl}/api/connection-details?roomName=${effectiveRoomName}&participantName=${effectiveParticipantName}`
        );
        const data = await resp.json();
        setToken(data.token);
      } catch (e) {
        console.error('Error fetching connection details:', e);
      }
    })();
  }, [effectiveRoomName, effectiveParticipantName, effectiveBackendUrl]);

  // Step 2: Create and manage the single WebSocket connection.
  useEffect(() => {
    if (!token) return; // Wait for the token before connecting.

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const domain = new URL(effectiveBackendUrl).host;
    const url = `${wsProtocol}//${domain}/ws/transcribe/${effectiveParticipantName}`;

    console.log(`🚀 Attempting to connect WebSocket to: ${url}`);
    const newWs = new WebSocket(url);

    newWs.onopen = () => {
      console.log('✅ WebSocket connection established.');
      setIsWsConnected(true);
      setWs(newWs);
    };

    newWs.onmessage = (event) => {
      try {
        const message: TranscriptMessage = JSON.parse(event.data);
        // We only care about the transcript text
        if (message.transcript) {
          setLatestTranscript(message.transcript);
        }
      } catch (error) {
        console.error('Failed to parse incoming message:', event.data, error);
      }
    };

    newWs.onclose = () => {
      console.log('❌ WebSocket connection closed.');
      setIsWsConnected(false);
    };

    newWs.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };

    // IMPORTANT: Cleanup function to close the WebSocket when the component unmounts.
    return () => {
      newWs.close();
    };
  }, [token, effectiveParticipantName, effectiveBackendUrl]); // This effect runs only when these details change.

  // Step 3: This function is called by LiveKit *after* it connects to the room.
  const onConnected = () => {
    console.log('Connected to LiveKit room');
    // Note: We'll handle audio capture through the WebSocket connection
    // The room connection is managed by the LiveKitRoom component
  };

  if (!token) {
    return <div>Getting token...</div>;
  }

  // Inner component to use hooks inside LiveKitRoom
  const CallScreenContent = () => {
    const tracks = useTracks(
      [
        { source: Track.Source.Camera, withPlaceholder: true },
        { source: Track.Source.ScreenShare, withPlaceholder: false },
      ],
      { onlySubscribed: false },
    );

    return (
      <VideoConference>
        <GridLayout tracks={tracks}>
          <ParticipantTile />
        </GridLayout>
        <ControlBar />
        <RoomAudioRenderer />
        {/* Pass the live transcript and connection status down to the assistant */}
        <LiveAssistant transcript={latestTranscript} isConnected={isWsConnected} />
      </VideoConference>
    );
  };

  return (
    <LiveKitRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      connect={true}
      // Pass our onConnected function to LiveKit
      onConnected={onConnected}
      audio={true} // We want audio
      video={false} // No video needed
      style={{ height: '100vh' }}
    >
      <CallScreenContent />
    </LiveKitRoom>
  );
};