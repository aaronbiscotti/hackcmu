'use client';

import React from 'react';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { ConnectionDetails } from '@/lib/types';
import {
  LocalUserChoices,
  RoomContext,
  useParticipants,
  useLocalParticipant,
} from '@livekit/components-react';
import ParticipantTile from './ParticipantTile';
import ExitConfirmationModal from './ExitConfirmationModal';
import CustomPreJoin from './CustomPreJoin';
import LiveAssistant from './LiveAssistant';
import {
  RoomOptions,
  VideoCodec,
  VideoPresets,
  Room,
  RoomConnectOptions,
  RoomEvent,
  TrackPublishDefaults,
  VideoCaptureOptions,
  Track,
} from 'livekit-client';
import { MicrophoneIcon, VideoCameraIcon, PhoneIcon, VideoCameraSlashIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';

const CONN_DETAILS_ENDPOINT = process.env.NEXT_PUBLIC_BACKEND_URL
  ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/connection-details`
  : 'http://localhost:8001/api/connection-details';

// ReactionBox component for displaying reactions based on LLM emotion
function ReactionBox({ room }: { room: Room }) {
  const [currentEmotion, setCurrentEmotion] = React.useState('idle');
  const [isShowingSurprised, setIsShowingSurprised] = React.useState(false);
  const [gifKey, setGifKey] = React.useState(0); // Force GIF restart

  React.useEffect(() => {
    if (!room) return;

    // Listen for emotion changes from LiveAssistant
    const handleEmotionChange = (event: CustomEvent) => {
      const emotion = event.detail;
      setCurrentEmotion(emotion);
      
      // If emotion is not idle, show surprised.gif
      if (emotion !== 'idle' && !isShowingSurprised) {
        setIsShowingSurprised(true);
        setGifKey(prev => prev + 1); // Force GIF restart
        
        // Reset to idle after GIF duration (assume 3 seconds for surprised.gif)
        setTimeout(() => {
          setIsShowingSurprised(false);
          setCurrentEmotion('idle');
        }, 3000);
      }
    };

    // Listen for custom emotion events
    window.addEventListener('emotion-change', handleEmotionChange as EventListener);

    return () => {
      window.removeEventListener('emotion-change', handleEmotionChange as EventListener);
    };
  }, [room, isShowingSurprised]);

  return (
    <div className="window" style={{ width: '200px', height: '250px' }}>
      <div className="title-bar">
        <div className="title-bar-text">Totter</div>
      </div>
      <div className="window-body" style={{ 
        padding: '8px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        height: 'calc(100% - 30px)' // Account for title bar
      }}>
        <div className="sunken-panel" style={{ 
          width: '100%', 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: '#c0c0c0'
        }}>
          {isShowingSurprised ? (
            <img 
              key={gifKey}
              src="/reactions/surprised.gif" 
              alt="Surprised reaction"
              style={{ 
                maxWidth: '100%', 
                maxHeight: '100%',
                objectFit: 'contain'
              }}
            />
          ) : (
            <img 
              src="/reactions/idle.png" 
              alt="Idle state"
              style={{ 
                maxWidth: '100%', 
                maxHeight: '100%',
                objectFit: 'contain'
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function CallScreen({ onEndCall, meetingCode, userName }: { onEndCall: () => void; meetingCode: string; userName: string }) {
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
  const preJoinDefaults = React.useMemo(() => {
    return {
      username: userName || '',
      videoEnabled: true,
      audioEnabled: true,
    };
  }, [userName]);
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );

  const handlePreJoinSubmit = React.useCallback(async (values: LocalUserChoices) => {
    setPreJoinChoices(values);
    const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
    url.searchParams.append('roomName', meetingCode);
    url.searchParams.append('participantName', values.username);
    const connectionDetailsResp = await fetch(url.toString());
    const connectionDetailsData = await connectionDetailsResp.json();
    setConnectionDetails(connectionDetailsData);
  }, [meetingCode]);
  const handlePreJoinError = React.useCallback((e: Error) => console.error(e), []);


  return (
    <div className="bg-snow h-screen flex flex-col overflow-hidden">
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <div className="bg-snow h-full flex items-center justify-center p-6">
          <CustomPreJoin
            defaults={preJoinDefaults}
            onSubmit={handlePreJoinSubmit}
            onError={handlePreJoinError}
          />
        </div>
      ) : (
        <VideoConferenceComponent
          connectionDetails={connectionDetails}
          userChoices={preJoinChoices}
          onEndCall={onEndCall}
        />
      )}
    </div>
  );
}

function VideoConferenceComponent(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  onEndCall: () => void;
}) {
  const roomOptions = React.useMemo((): RoomOptions => {
    const videoCaptureDefaults: VideoCaptureOptions = {
      deviceId: props.userChoices.videoDeviceId ?? undefined,
      resolution: VideoPresets.h720,
    };
    const publishDefaults: TrackPublishDefaults = {
      dtx: false,
      videoSimulcastLayers: [VideoPresets.h540, VideoPresets.h216],
      red: true,
      videoCodec: 'vp8' as VideoCodec,
    };
    return {
      videoCaptureDefaults: videoCaptureDefaults,
      publishDefaults: publishDefaults,
      audioCaptureDefaults: {
        deviceId: props.userChoices.audioDeviceId ?? undefined,
      },
      adaptiveStream: true,
      dynacast: true,
    };
  }, [props.userChoices]);

  const room = React.useMemo(() => new Room(roomOptions), [roomOptions]);

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  const handleOnLeave = React.useCallback(() => {
    props.onEndCall();
  }, [props]);
  const handleError = React.useCallback((error: Error) => {
    console.error(error);
    alert(`Encountered an unexpected error, check the console logs for details: ${error.message}`);
  }, []);

  React.useEffect(() => {
    room.on(RoomEvent.Disconnected, handleOnLeave);
    room.on(RoomEvent.MediaDevicesError, handleError);

    room
      .connect(
        props.connectionDetails.serverUrl,
        props.connectionDetails.participantToken,
        connectOptions,
      )
      .catch((error) => {
        handleError(error);
      });
    if (props.userChoices.videoEnabled) {
      room.localParticipant.setCameraEnabled(true).catch((error) => {
        handleError(error);
      });
    }
    if (props.userChoices.audioEnabled) {
      room.localParticipant.setMicrophoneEnabled(true).catch((error) => {
        handleError(error);
      });
    }

    return () => {
      room.off(RoomEvent.Disconnected, handleOnLeave);
      room.off(RoomEvent.MediaDevicesError, handleError);
    };
  }, [room, props.connectionDetails, props.userChoices, connectOptions, handleError, handleOnLeave]);

  const lowPowerMode = useLowCPUOptimizer(room);

  React.useEffect(() => {
    if (lowPowerMode) {
      console.warn('Low power mode enabled');
    }
  }, [lowPowerMode]);

  return (
    <div style={{ backgroundColor: 'white', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <RoomContext.Provider value={room}>
        <KeyboardShortcuts />
        <LiveAssistant room={room} />
        <CustomVideoConference onEndCall={props.onEndCall} />
      </RoomContext.Provider>
    </div>
  );
}

function CustomVideoConference({ onEndCall }: { onEndCall: () => void }) {
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  const [showExitModal, setShowExitModal] = React.useState(false);
  const [micEnabled, setMicEnabled] = React.useState(true);
  const [cameraEnabled, setCameraEnabled] = React.useState(true);

  // Use room context to get access to the room
  const room = React.useContext(RoomContext);

  const toggleMic = React.useCallback(async () => {
    if (room) {
      try {
        await room.localParticipant.setMicrophoneEnabled(!micEnabled);
        setMicEnabled(!micEnabled);
      } catch (error) {
        console.error('Error toggling microphone:', error);
      }
    }
  }, [room, micEnabled]);

  const toggleCamera = React.useCallback(async () => {
    if (room) {
      try {
        await room.localParticipant.setCameraEnabled(!cameraEnabled);
        setCameraEnabled(!cameraEnabled);
      } catch (error) {
        console.error('Error toggling camera:', error);
      }
    }
  }, [room, cameraEnabled]);

  // Update state when track publications change
  React.useEffect(() => {
    if (!room) return;

    const updateTrackStates = () => {
      const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);

      setMicEnabled(micPub?.isEnabled ?? false);
      setCameraEnabled(camPub?.isEnabled ?? false);
    };

    // Update initially
    updateTrackStates();

    // Listen for track changes
    room.localParticipant.on('trackPublished', updateTrackStates);
    room.localParticipant.on('trackUnpublished', updateTrackStates);
    room.localParticipant.on('trackMuted', updateTrackStates);
    room.localParticipant.on('trackUnmuted', updateTrackStates);

    return () => {
      room.localParticipant.off('trackPublished', updateTrackStates);
      room.localParticipant.off('trackUnpublished', updateTrackStates);
      room.localParticipant.off('trackMuted', updateTrackStates);
      room.localParticipant.off('trackUnmuted', updateTrackStates);
    };
  }, [room]);

  const handleEndCall = () => {
    setShowExitModal(true);
  };

  const confirmEndCall = () => {
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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'white', position: 'relative' }}>
      {/* Overlay Reaction Box - Top left */}
      {room && (
        <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 1000 }}>
          <ReactionBox room={room} />
        </div>
      )}
      
      {/* Video Grid - Takes up most of the screen with reduced padding */}
      <div style={{ flex: 1, padding: '1rem', overflow: 'hidden' }}>
        {participants.length > 0 ? (
          <div className={`h-full grid gap-4 ${getGridLayout(participants.length)}`}>
            {participants.map((participant) => (
              <div key={participant.identity} className="sunken-panel" style={{ overflow: 'hidden', position: 'relative', backgroundColor: '#c0c0c0' }}>
                <ParticipantTile participant={participant} />
                {participant === localParticipant.localParticipant && (
                  <div style={{ 
                    position: 'absolute', 
                    top: '8px', 
                    left: '8px', 
                    backgroundColor: 'rgba(0,0,0,0.7)', 
                    color: 'white', 
                    padding: '2px 6px', 
                    fontSize: '11px' 
                  }}>
                    You
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="sunken-panel" style={{ 
            height: '100%', 
            width: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: '#c0c0c0'
          }}>
            <p style={{ color: '#666' }}>Waiting for others to join...</p>
          </div>
        )}
      </div>

      {/* Custom Control Bar - Fixed at bottom */}
      <div style={{ 
        flexShrink: 0, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: '1rem', 
        padding: '1rem',
        backgroundColor: '#c0c0c0',
        borderTop: '1px solid #808080'
      }}>
        {/* Microphone Button */}
        <button
          onClick={toggleMic}
          style={{ 
            padding: '8px 16px',
            backgroundColor: micEnabled ? '#008000' : '#800000',
            color: 'white',
            minWidth: '100px'
          }}
        >
          {micEnabled ? '🎤 ON' : '🎤 OFF'}
        </button>

        {/* Camera Button */}
        <button
          onClick={toggleCamera}
          style={{ 
            padding: '8px 16px',
            backgroundColor: cameraEnabled ? '#008000' : '#800000',
            color: 'white',
            minWidth: '100px'
          }}
        >
          {cameraEnabled ? '📹 ON' : '📹 OFF'}
        </button>

        {/* Leave Button */}
        <button
          onClick={handleEndCall}
          style={{ 
            padding: '8px 16px',
            backgroundColor: '#800000',
            color: 'white',
            minWidth: '100px'
          }}
        >
          📞 LEAVE
        </button>
      </div>

      <ExitConfirmationModal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        onConfirm={confirmEndCall}
      />
    </div>
  );
}
