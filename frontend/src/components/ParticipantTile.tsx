// src/components/ParticipantTile.tsx
"use client";
import { Participant, Track } from 'livekit-client';
import React, { useEffect, useRef, useState } from 'react';

interface ParticipantTileProps {
  participant: Participant;
}

export default function ParticipantTile({ participant }: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  useEffect(() => {
    const updateTracks = () => {
      // Handle video track
      const videoPublication = participant.getTrackPublication(Track.Source.Camera);
      const videoTrack = videoPublication?.videoTrack;
      
      // Fix: Show video element if track exists and is subscribed, regardless of mute state
      const isVideoAvailable = !!videoTrack && videoPublication?.isSubscribed;
      setHasVideo(isVideoAvailable);

      if (isVideoAvailable && videoRef.current) {
        videoTrack.attach(videoRef.current);
      }

      // Handle audio track
      const audioPublication = participant.getTrackPublication(Track.Source.Microphone);
      const audioTrack = audioPublication?.audioTrack;
      if (audioTrack && audioRef.current && audioPublication?.isSubscribed) {
        audioTrack.attach(audioRef.current);
      }
    };

    // Initial track setup
    updateTracks();

    // Listen for track events
    const handleTrackSubscribed = () => {
      updateTracks();
    };

    const handleTrackUnsubscribed = () => {
      updateTracks();
    };

    const handleTrackMuted = () => {
      updateTracks();
    };

    const handleTrackUnmuted = () => {
      updateTracks();
    };

    const handleIsSpeakingChanged = () => {
      setIsSpeaking(participant.isSpeaking);
    };

    // Set initial speaking state
    setIsSpeaking(participant.isSpeaking);

    participant.on('trackSubscribed', handleTrackSubscribed);
    participant.on('trackUnsubscribed', handleTrackUnsubscribed);
    participant.on('trackMuted', handleTrackMuted);
    participant.on('trackUnmuted', handleTrackUnmuted);
    participant.on('isSpeakingChanged', handleIsSpeakingChanged);

    // Cleanup function
    return () => {
      const videoPublication = participant.getTrackPublication(Track.Source.Camera);
      const audioPublication = participant.getTrackPublication(Track.Source.Microphone);
      
      if (videoPublication?.videoTrack && videoRef.current) {
        videoPublication.videoTrack.detach(videoRef.current);
      }
      if (audioPublication?.audioTrack && audioRef.current) {
        audioPublication.audioTrack.detach(audioRef.current);
      }
      
      participant.off('trackSubscribed', handleTrackSubscribed);
      participant.off('trackUnsubscribed', handleTrackUnsubscribed);
      participant.off('trackMuted', handleTrackMuted);
      participant.off('trackUnmuted', handleTrackUnmuted);
      participant.off('isSpeakingChanged', handleIsSpeakingChanged);
    };
  }, [participant]);

  return (
    <div className={`relative h-full w-full bg-feather-green ${isSpeaking ? 'ring-4 ring-blue-500 ring-opacity-75' : ''}`}>
      {hasVideo ? (
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          autoPlay
          playsInline
          muted={participant.isLocal}
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center">
          <div className="bg-snow rounded-full flex items-center justify-center text-eel font-bold w-32 h-32 text-4xl">
            {getInitials(participant.identity)}
          </div>
        </div>
      )}
      
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        muted={participant.isLocal}
      />
      
      <div className="absolute bottom-3 left-3">
        <h3 className="text-snow font-medium text-sm drop-shadow-lg">
          {participant.identity}
        </h3>
      </div>
    </div>
  );
}
