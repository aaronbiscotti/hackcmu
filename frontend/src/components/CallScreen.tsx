'use client';

import React from 'react';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { ConnectionDetails } from '@/lib/types';
import {
  LocalUserChoices,
  RoomContext,
  GridLayout,
  ParticipantTile,
  VideoConference,
  TrackToggle,
  useTracks,
  ControlBar,
} from '@livekit/components-react';
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
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
} from 'livekit-client';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';

const CONN_DETAILS_ENDPOINT = process.env.NEXT_PUBLIC_BACKEND_URL
  ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/connection-details`
  : 'https://361c01c7de59.ngrok-free.app/api/connection-details';

// Fallback endpoint (can be set via environment variable)
const CONN_DETAILS_FALLBACK = process.env.NEXT_PUBLIC_BACKEND_FALLBACK_URL
  ? `${process.env.NEXT_PUBLIC_BACKEND_FALLBACK_URL}/api/connection-details`
  : 'http://localhost:8001/api/connection-details';

// ReactionBox component for displaying reactions based on LLM emotion
function ReactionBox({ room }: { room: Room }) {
  const [isShowingSurprised, setIsShowingSurprised] = React.useState(false);
  const [gifKey, setGifKey] = React.useState(0); // Force GIF restart

  React.useEffect(() => {
    if (!room) return;

    // Listen for emotion changes from LiveAssistant
    const handleEmotionChange = (event: CustomEvent) => {
      const emotion = event.detail;

      // If emotion is not idle, show surprised.gif
      if (emotion !== 'idle' && !isShowingSurprised) {
        setIsShowingSurprised(true);
        setGifKey(prev => prev + 1); // Force GIF restart

        // Reset to idle after GIF duration (assume 3 seconds for surprised.gif)
        setTimeout(() => {
          setIsShowingSurprised(false);
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
    <div className="window" style={{ width: '220px', height: '300px' }}>
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
    
    // Try ngrok endpoint first, fallback to localhost
    const tryFetch = async (endpoint: string) => {
      const url = new URL(endpoint);
      url.searchParams.append('roomName', meetingCode);
      url.searchParams.append('participantName', values.username);
      
      // Use simple GET request to avoid CORS preflight
      return fetch(url.toString(), { 
        method: 'GET',
        mode: 'cors',
        credentials: 'omit', // Don't send credentials to avoid CORS issues
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
    };

    try {
      console.log('Trying primary endpoint:', CONN_DETAILS_ENDPOINT);
      let connectionDetailsResp = await tryFetch(CONN_DETAILS_ENDPOINT);
      
      // If primary fails, try fallback
      if (!connectionDetailsResp.ok) {
        console.log('Primary endpoint failed, trying fallback...');
        connectionDetailsResp = await tryFetch(CONN_DETAILS_FALLBACK);
      }
      
      if (!connectionDetailsResp.ok) {
        throw new Error(`HTTP ${connectionDetailsResp.status}: ${connectionDetailsResp.statusText}`);
      }
      
      const connectionDetailsData = await connectionDetailsResp.json();
      setConnectionDetails(connectionDetailsData);
    } catch (error) {
      console.error('Connection failed:', error);
      alert('Failed to connect to backend. Please make sure the backend server is running on https://361c01c7de59.ngrok-free.app');
      throw error;
    }
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
      adaptiveStream: true, // Enable adaptive streaming to fix video subscription issues
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
    const handleParticipantConnected = (participant: RemoteParticipant) => {
      console.log('Participant connected:', participant.identity);
      // Subscribe to all tracks from new participants
      participant.trackPublications.forEach((publication) => {
        if (publication.isSubscribed) return;
        console.log('Auto-subscribing to track:', publication.trackSid, 'from', participant.identity);
        publication.setSubscribed(true);
      });
    };

    const handleTrackPublished = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      console.log('Track published:', publication.trackSid, publication.kind, 'from', participant.identity);
      // Automatically subscribe to newly published tracks
      if (!publication.isSubscribed) {
        console.log('Auto-subscribing to newly published track:', publication.trackSid);
        publication.setSubscribed(true);
      }
    };

    const handleTrackSubscribed = (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      console.log('Track subscribed:', track.kind, 'from', participant.identity);
    };

    room.on(RoomEvent.Disconnected, handleOnLeave);
    room.on(RoomEvent.MediaDevicesError, handleError);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.TrackPublished, handleTrackPublished);
    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);

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
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.TrackPublished, handleTrackPublished);
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
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
        
        {/* Full Height Video Conference with Totter Overlay */}
        <div style={{ flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <VideoConference>
            <VideoGrid />
            <ControlBar>
              <TrackToggle source={Track.Source.Microphone} />
              <TrackToggle source={Track.Source.Camera} />
              <button onClick={props.onEndCall} style={{ backgroundColor: '#800000', color: 'white', padding: '8px 16px' }}>
                Leave
              </button>
            </ControlBar>
          </VideoConference>
          
          {/* Totter Character Overlay - Top Left */}
          <div style={{ 
            position: 'absolute', 
            top: '20px', 
            left: '20px', 
            zIndex: 1000 
          }}>
            <ReactionBox room={room} />
          </div>
        </div>
      </RoomContext.Provider>
    </div>
  );
}

function VideoGrid() {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], { onlySubscribed: false });
  
  return (
    <GridLayout tracks={tracks}>
      <ParticipantTile />
    </GridLayout>
  );
}

