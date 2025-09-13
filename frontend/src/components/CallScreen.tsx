'use client';

import React from 'react';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { ConnectionDetails } from '@/lib/types';
import {
  LocalUserChoices,
  RoomContext,
  useParticipants,
  useLocalParticipant,
  useTrackToggle,
} from '@livekit/components-react';
import ParticipantTile from './ParticipantTile';
import ExitConfirmationModal from './ExitConfirmationModal';
import CustomPreJoin from './CustomPreJoin';
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
    <div className="bg-snow h-screen flex flex-col overflow-hidden">
      <RoomContext.Provider value={room}>
        <KeyboardShortcuts />
        <CustomVideoConference onEndCall={props.onEndCall} />
      </RoomContext.Provider>
    </div>
  );
}

function CustomVideoConference({ onEndCall }: { onEndCall: () => void }) {
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  const [showExitModal, setShowExitModal] = React.useState(false);

  const { toggle: toggleMic, enabled: micEnabled } = useTrackToggle({
    source: Track.Source.Microphone
  });

  const { toggle: toggleCamera, enabled: cameraEnabled } = useTrackToggle({
    source: Track.Source.Camera
  });

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
    <div className="h-screen flex flex-col bg-snow">
      {/* Video Grid - Takes up most of the screen with equal padding */}
      <div className="flex-1 p-8 overflow-hidden">
        {participants.length > 0 ? (
          <div className={`h-full grid gap-4 ${getGridLayout(participants.length)}`}>
            {participants.map((participant) => (
              <div key={participant.identity} className="bg-gray-300 rounded-xl overflow-hidden relative">
                <ParticipantTile participant={participant} />
                {participant === localParticipant.localParticipant && (
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

      {/* Custom Control Bar - Fixed at bottom */}
      <div className="flex-shrink-0 flex items-center justify-center gap-6 p-8">
        {/* Microphone Button */}
        <button
          onClick={() => toggleMic()}
          className={`p-4 rounded-full transition-colors duration-200 ${
            micEnabled
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {micEnabled ? (
            <MicrophoneIcon className="h-6 w-6 text-white" />
          ) : (
            <SpeakerXMarkIcon className="h-6 w-6 text-white" />
          )}
        </button>

        {/* Camera Button */}
        <button
          onClick={() => toggleCamera()}
          className={`p-4 rounded-full transition-colors duration-200 ${
            cameraEnabled
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {cameraEnabled ? (
            <VideoCameraIcon className="h-6 w-6 text-white" />
          ) : (
            <VideoCameraSlashIcon className="h-6 w-6 text-white" />
          )}
        </button>

        {/* Leave Button */}
        <button
          onClick={handleEndCall}
          className="bg-red-600 hover:bg-red-700 p-4 rounded-full transition-colors duration-200"
        >
          <PhoneIcon className="h-6 w-6 text-white" />
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
