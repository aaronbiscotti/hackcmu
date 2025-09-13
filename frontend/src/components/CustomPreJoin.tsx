"use client";
import React from 'react';
import { Track } from 'livekit-client';
import {
  usePreviewTracks,
  TrackToggle,
  LocalUserChoices,
  usePersistentUserChoices
} from '@livekit/components-react';
import { MicrophoneIcon, VideoCameraIcon, VideoCameraSlashIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline';
import { ParticipantPlaceholder } from '@livekit/components-react';

interface CustomPreJoinProps {
  onSubmit?: (values: LocalUserChoices) => void;
  onValidate?: (values: LocalUserChoices) => boolean;
  onError?: (error: Error) => void;
  defaults?: Partial<LocalUserChoices>;
  joinLabel?: string;
  micLabel?: string;
  camLabel?: string;
  userLabel?: string;
}

export default function CustomPreJoin({
  defaults = {},
  onValidate,
  onSubmit,
  onError,
  joinLabel = 'Join Room',
  micLabel = 'Microphone',
  camLabel = 'Camera',
  userLabel = 'Username',
}: CustomPreJoinProps) {
  const {
    userChoices: initialUserChoices,
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveUsername,
  } = usePersistentUserChoices({
    defaults,
    preventSave: false,
    preventLoad: false,
  });

  const [userChoices, setUserChoices] = React.useState(initialUserChoices);
  const [username, setUsername] = React.useState(userChoices.username);
  const [audioEnabled, setAudioEnabled] = React.useState<boolean>(userChoices.audioEnabled);
  const [videoEnabled, setVideoEnabled] = React.useState<boolean>(userChoices.videoEnabled);

  const videoEl = React.useRef<HTMLVideoElement>(null);

  const tracks = usePreviewTracks({
    audio: audioEnabled,
    video: videoEnabled,
  }, onError);

  const videoTrack = React.useMemo(
    () => tracks?.find((track) => track.kind === Track.Kind.Video),
    [tracks],
  );

  const audioTrack = React.useMemo(
    () => tracks?.find((track) => track.kind === Track.Kind.Audio),
    [tracks],
  );

  React.useEffect(() => {
    if (videoEl.current && videoTrack) {
      videoTrack.unmute();
      videoTrack.attach(videoEl.current);
    }

    return () => {
      videoTrack?.detach();
    };
  }, [videoTrack]);

  const [isValid, setIsValid] = React.useState<boolean>();

  const handleValidation = React.useCallback(
    (values: LocalUserChoices) => {
      if (typeof onValidate === 'function') {
        return onValidate(values);
      } else {
        return values.username !== '';
      }
    },
    [onValidate],
  );

  React.useEffect(() => {
    const newUserChoices = {
      username,
      videoEnabled,
      videoDeviceId: userChoices.videoDeviceId,
      audioEnabled,
      audioDeviceId: userChoices.audioDeviceId,
    };
    setUserChoices(newUserChoices);
    setIsValid(handleValidation(newUserChoices));
  }, [username, videoEnabled, handleValidation, audioEnabled, userChoices.audioDeviceId, userChoices.videoDeviceId]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (handleValidation(userChoices)) {
      if (typeof onSubmit === 'function') {
        onSubmit(userChoices);
      }
    }
  }

  const handleAudioToggle = () => {
    const newEnabled = !audioEnabled;
    setAudioEnabled(newEnabled);
    saveAudioInputEnabled(newEnabled);
  };

  const handleVideoToggle = () => {
    const newEnabled = !videoEnabled;
    setVideoEnabled(newEnabled);
    saveVideoInputEnabled(newEnabled);
  };

  return (
    <div className="window" style={{ maxWidth: '400px', margin: '0 auto' }}>
      <div className="title-bar">
        <div className="title-bar-text">Join Meeting</div>
      </div>
      <div className="window-body" style={{ padding: '1rem' }}>
        {/* Video Preview */}
        <div className="sunken-panel" style={{ 
          marginBottom: '1rem', 
          padding: '0',
          height: '200px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000'
        }}>
          {videoTrack && videoEnabled ? (
            <video
              ref={videoEl}
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',
                transform: 'scaleX(-1)' 
              }}
              autoPlay
              playsInline
              muted
            />
          ) : (
            <div style={{ 
              width: '100%', 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: '#333'
            }}>
              <div style={{ textAlign: 'center', color: '#ccc' }}>
                <div style={{ marginBottom: '0.5rem' }}>📹</div>
                <p style={{ fontSize: '12px', margin: 0 }}>Camera is off</p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '0.5rem', 
          marginBottom: '1rem' 
        }}>
          {/* Microphone Toggle */}
          <button
            onClick={handleAudioToggle}
            style={{ 
              padding: '8px 12px',
              backgroundColor: audioEnabled ? '#008000' : '#800000',
              color: 'white',
              width: '90px'
            }}
          >
            {audioEnabled ? '🎤 ON' : '🎤 OFF'}
          </button>

          {/* Camera Toggle */}
          <button
            onClick={handleVideoToggle}
            style={{ 
              padding: '8px 12px',
              backgroundColor: videoEnabled ? '#008000' : '#800000',
              color: 'white',
              width: '90px'
            }}
          >
            {videoEnabled ? '📹 ON' : '📹 OFF'}
          </button>
        </div>

        {/* Username and Join Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="username" style={{ display: 'block', marginBottom: '0.25rem' }}>
              {userLabel}:
            </label>
            <input
              id="username"
              name="username"
              type="text"
              value={username}
              placeholder={userLabel}
              onChange={(e) => {
                setUsername(e.target.value);
                saveUsername(e.target.value);
              }}
              autoComplete="off"
              style={{ width: '100%', padding: '8px 12px', fontSize: '14px', height: '32px' }}
            />
          </div>
          <button
            type="submit"
            disabled={!isValid}
            style={{ 
              width: '100%',
              padding: '8px 16px',
              fontSize: '14px',
              opacity: isValid ? 1 : 0.5,
              cursor: isValid ? 'pointer' : 'not-allowed'
            }}
          >
            {joinLabel}
          </button>
        </form>
      </div>
    </div>
  );
}