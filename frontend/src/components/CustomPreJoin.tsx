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
    <div className="bg-white rounded-2xl p-8 max-w-md mx-auto">
      {/* Video Preview */}
      <div className="relative mb-6 bg-gray-900 rounded-xl overflow-hidden aspect-video h-48">
        {videoTrack && videoEnabled ? (
          <video
            ref={videoEl}
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
            autoPlay
            playsInline
            muted
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <div className="text-center">
              <div className="bg-gray-700 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <VideoCameraSlashIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-400 text-sm">Camera is off</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4 mb-6">
        {/* Microphone Toggle */}
        <button
          onClick={handleAudioToggle}
          className={`p-3 rounded-full transition-colors duration-200 ${
            audioEnabled
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {audioEnabled ? (
            <MicrophoneIcon className="h-6 w-6 text-white" />
          ) : (
            <SpeakerXMarkIcon className="h-6 w-6 text-white" />
          )}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={handleVideoToggle}
          className={`p-3 rounded-full transition-colors duration-200 ${
            videoEnabled
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {videoEnabled ? (
            <VideoCameraIcon className="h-6 w-6 text-white" />
          ) : (
            <VideoCameraSlashIcon className="h-6 w-6 text-white" />
          )}
        </button>
      </div>

      {/* Username and Join Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl focus:outline-none focus:border-feather-green text-eel placeholder-eel/50"
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
        />
        <button
          className={`w-full py-3 px-6 rounded-xl font-medium transition-colors duration-200 ${
            isValid
              ? 'bg-feather-green text-white hover:bg-mask-green'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          type="submit"
          disabled={!isValid}
        >
          {joinLabel}
        </button>
      </form>
    </div>
  );
}