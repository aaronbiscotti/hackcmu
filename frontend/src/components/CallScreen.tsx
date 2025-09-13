// src/components/CallScreen.tsx
"use client";
import React, { useState, useEffect } from 'react';
import { Room, RoomEvent, LocalParticipant, RemoteParticipant, Track, RoomOptions, DisconnectReason } from 'livekit-client';
import { MicrophoneIcon, VideoCameraIcon, PhoneIcon, VideoCameraSlashIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline';
import ExitConfirmationModal from './ExitConfirmationModal';
import ParticipantTile from './ParticipantTile';
import ErrorToast from './ErrorToast';

export default function CallScreen({ onEndCall, meetingCode, userName }: { onEndCall: () => void; meetingCode: string; userName: string }) {
  const [room, setRoom] = useState<Room | undefined>();
  const [participants, setParticipants] = useState<(LocalParticipant | RemoteParticipant)[]>([]);
  const [isMicMuted, setMicMuted] = useState(false);
  const [isCameraOff, setCameraOff] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Effect to connect to the LiveKit room
  useEffect(() => {
    let currentRoom: Room | null = null;
    let isConnecting = false;
    let isMounted = true;

    const connectToRoom = async () => {
      if (isConnecting || !isMounted) return;
      isConnecting = true;

      try {
        // Ensure we're in a browser environment
        if (typeof window === 'undefined') {
          throw new Error('Room can only be created in browser environment');
        }

        // Import Room dynamically to ensure it's loaded properly
        const { Room: LiveKitRoom } = await import('livekit-client');
        
        // Create a new Room instance with explicit options
        const roomOptions: RoomOptions = {
          adaptiveStream: true,
          dynacast: true,
        };
        currentRoom = new LiveKitRoom(roomOptions);
        
        // Verify Room instance was created successfully
        if (!currentRoom) {
          throw new Error('Failed to create Room instance');
        }

        // Fetch the token from our API route
        const response = await fetch(`/api/get-livekit-token?room=${meetingCode}&username=${userName}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(`Token request failed: ${response.status} - ${errorData.error}`);
        }
        
        const { token } = await response.json();
        if (!token) {
          throw new Error('No token received from server');
        }

        // Connect to the room with the token and server URL
        const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
        if (!serverUrl) {
          throw new Error('NEXT_PUBLIC_LIVEKIT_URL is not configured');
        }
        
        if (!isMounted) return; // Component was unmounted
        
        await currentRoom.connect(serverUrl, token);

        if (!isMounted) return; // Component was unmounted

        // Publish user's camera and microphone after successful connection
        await currentRoom.localParticipant.setCameraEnabled(true);
        await currentRoom.localParticipant.setMicrophoneEnabled(true);

        if (isMounted) {
          setRoom(currentRoom);
        }
      } catch (error) {
        console.error('Failed to connect to LiveKit room:', error);
        
        const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
        
        // Show user-friendly error message
        if (isMounted) {
          setErrorMessage(`Failed to join the call: ${errorMsg}`);
        }
        
        console.error('Error details:', {
          message: errorMsg,
          stack: error instanceof Error ? error.stack : 'No stack trace',
          currentRoom: !!currentRoom,
          hasConnect: currentRoom && typeof currentRoom.connect === 'function'
        });
        
        // Clean up on error
        if (currentRoom) {
          try {
            currentRoom.disconnect();
          } catch (disconnectError) {
            console.error('Error during cleanup disconnect:', disconnectError);
          }
          currentRoom = null;
        }
      } finally {
        isConnecting = false;
      }
    };

    connectToRoom();

    // Cleanup: disconnect from the room when the component unmounts
    return () => {
      isMounted = false;
      if (currentRoom) {
        try {
          currentRoom.disconnect();
        } catch (error) {
          console.error('Error during component unmount disconnect:', error);
        }
        currentRoom = null;
      }
    };
  }, [meetingCode, userName]);

  // Effect to handle room events and update participants
  useEffect(() => {
    if (!room) return;

    const updateParticipants = () => {
      const allParticipants = [room.localParticipant, ...Array.from(room.remoteParticipants.values())];
      setParticipants(allParticipants);
    };

    const handleTrackMuted = (publication: any, participant: any) => {
      if (participant === room.localParticipant) {
        if (publication.source === Track.Source.Microphone) {
          setMicMuted(publication.isMuted);
        } else if (publication.source === Track.Source.Camera) {
          setCameraOff(publication.isMuted);
        }
      }
    };

    const handleTrackUnmuted = (publication: any, participant: any) => {
      if (participant === room.localParticipant) {
        if (publication.source === Track.Source.Microphone) {
          setMicMuted(publication.isMuted);
        } else if (publication.source === Track.Source.Camera) {
          setCameraOff(publication.isMuted);
        }
      }
    };

    // Initial update
    updateParticipants();

    const handleDisconnected = (reason?: DisconnectReason) => {
      const reasonText = reason ? `Reason: ${reason}` : 'Unknown reason';
      setErrorMessage(`Connection lost: ${reasonText}`);
    };

    const handleReconnecting = () => {
      setErrorMessage('Reconnecting to the call...');
    };

    const handleReconnected = () => {
      setErrorMessage(null);
    };

    // Set up listeners for room events
    room.on(RoomEvent.ParticipantConnected, updateParticipants);
    room.on(RoomEvent.ParticipantDisconnected, updateParticipants);
    room.on(RoomEvent.TrackSubscribed, updateParticipants);
    room.on(RoomEvent.TrackUnsubscribed, updateParticipants);
    room.on(RoomEvent.TrackMuted, handleTrackMuted);
    room.on(RoomEvent.TrackUnmuted, handleTrackUnmuted);
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.Reconnecting, handleReconnecting);
    room.on(RoomEvent.Reconnected, handleReconnected);

    // Cleanup listeners
    return () => {
      room.off(RoomEvent.ParticipantConnected, updateParticipants);
      room.off(RoomEvent.ParticipantDisconnected, updateParticipants);
      room.off(RoomEvent.TrackSubscribed, updateParticipants);
      room.off(RoomEvent.TrackUnsubscribed, updateParticipants);
      room.off(RoomEvent.TrackMuted, handleTrackMuted);
      room.off(RoomEvent.TrackUnmuted, handleTrackUnmuted);
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.off(RoomEvent.Reconnecting, handleReconnecting);
      room.off(RoomEvent.Reconnected, handleReconnected);
    };
  }, [room]);

  const handleToggleMic = async () => {
    if (room) {
      const newEnabledState = isMicMuted; // If currently muted, enable it
      await room.localParticipant.setMicrophoneEnabled(newEnabledState);
      // State will be updated by the room event listeners
    }
  };

  const handleToggleCamera = async () => {
    if (room) {
      const newEnabledState = isCameraOff; // If currently off, enable it
      await room.localParticipant.setCameraEnabled(newEnabledState);
      // State will be updated by the room event listeners
    }
  };

  const handleConfirmExit = () => {
    room?.disconnect();
    setShowExitModal(false);
    onEndCall();
  };

  // Helper function to determine grid layout based on participant count
  const getGridLayout = (count: number) => {
    if (count === 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-1 md:grid-cols-2";
    if (count <= 4) return "grid-cols-2";
    if (count <= 6) return "grid-cols-2 lg:grid-cols-3";
    return "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  };

  return (
    <div className="bg-snow h-screen flex flex-col overflow-hidden">
      {/* Main Video Area - Refactored to show all participants in a grid */}
      <div className="flex-1 m-6 overflow-hidden">
        {participants.length > 0 ? (
          <div className={`h-full grid gap-4 ${getGridLayout(participants.length)}`}>
            {participants.map(participant => (
              <div key={participant.identity} className="bg-gray-300 rounded-xl overflow-hidden relative">
                <ParticipantTile participant={participant} />
                {/* Show "You" label for local participant */}
                {participant === room?.localParticipant && (
                  <div className="absolute top-3 left-3 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                    You
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full w-full bg-gray-400 rounded-xl flex items-center justify-center">
            <p className="text-gray-600">Waiting for others to join...</p>
          </div>
        )}
      </div>

      {/* Bottom UI Controls */}
      <div className="bg-snow p-6">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-lg text-eel">{meetingCode}</span>

          {/* Center Controls */}
          <div className="flex items-center space-x-3">
            <button onClick={handleToggleMic} className={`p-3 rounded-full transition-colors duration-300 ${isMicMuted ? 'bg-red-600' : 'bg-eel/20 hover:bg-eel/30'}`}>
              {isMicMuted ? <SpeakerXMarkIcon className="h-6 w-6 text-snow" /> : <MicrophoneIcon className="h-6 w-6 text-eel" />}
            </button>
            <button onClick={handleToggleCamera} className={`p-3 rounded-full transition-colors duration-300 ${isCameraOff ? 'bg-red-600' : 'bg-eel/20 hover:bg-eel/30'}`}>
              {isCameraOff ? <VideoCameraSlashIcon className="h-6 w-6 text-snow" /> : <VideoCameraIcon className="h-6 w-6 text-eel" />}
            </button>
            <button onClick={() => setShowExitModal(true)} className="bg-red-600 p-3 rounded-full hover:bg-red-700 transition-colors duration-300 ml-4">
              <PhoneIcon className="h-6 w-6 text-snow" />
            </button>
          </div>

          {/* Right Side Spacer */}
          <div></div>
        </div>
      </div>

      <ExitConfirmationModal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        onConfirm={handleConfirmExit}
      />

      {/* Error Toast */}
      <ErrorToast
        message={errorMessage || ''}
        isVisible={!!errorMessage}
        onClose={() => setErrorMessage(null)}
      />
    </div>
  );
}
