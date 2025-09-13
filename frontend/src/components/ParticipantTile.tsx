// src/components/ParticipantTile.tsx
"use client";
import {
  Participant,
  Track,
  TrackPublication,
  ParticipantEvent,
} from 'livekit-client';
import React, { useEffect, useRef, useState } from 'react';
import { VideoCameraSlashIcon } from '@heroicons/react/24/outline';

interface ParticipantTileProps {
  participant: Participant;
}

export default function ParticipantTile({ participant }: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [videoPublication, setVideoPublication] = useState<TrackPublication | undefined>();
  const [audioPublication, setAudioPublication] = useState<TrackPublication | undefined>();
  const [isSpeaking, setIsSpeaking] = useState(participant.isSpeaking);
  const [isCameraMuted, setIsCameraMuted] = useState(false);

  const cleanName = (name: string) => {
    return name.replace(/_vpbx$/, '');
  };

  const getInitials = (fullName: string) => {
    const cleanedName = cleanName(fullName);
    return cleanedName
      .split(' ')
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  useEffect(() => {
    const updateVideoPublication = () => {
      const pub = participant.getTrackPublication(Track.Source.Camera);
      if (pub && pub.track && !pub.isSubscribed) {
        console.log('Video track not subscribed for:', participant.identity);
      }
      setVideoPublication(pub);
      setIsCameraMuted(pub?.isMuted ?? false);
    };

    const updateAudioPublication = () => {
      const pub = participant.getTrackPublication(Track.Source.Microphone);
      if (pub && pub.track && !pub.isSubscribed) {
        console.log('Audio track not subscribed for:', participant.identity);
      }
      setAudioPublication(pub);
    };

    const onTrackMuted = (publication: TrackPublication) => {
      if (publication.kind === Track.Kind.Video) {
        setIsCameraMuted(true);
      }
    };

    const onTrackUnmuted = (publication: TrackPublication) => {
      if (publication.kind === Track.Kind.Video) {
        setIsCameraMuted(false);
      }
    };
    
    const onIsSpeakingChanged = () => {
      setIsSpeaking(participant.isSpeaking);
    };

    // Set initial state
    updateVideoPublication();
    updateAudioPublication();

    // Add listeners for all relevant events
    participant.on(ParticipantEvent.TrackPublished, updateVideoPublication);
    participant.on(ParticipantEvent.TrackUnpublished, updateVideoPublication);
    participant.on(ParticipantEvent.TrackSubscribed, updateVideoPublication);
    participant.on(ParticipantEvent.TrackUnsubscribed, updateVideoPublication);
    participant.on(ParticipantEvent.TrackMuted, onTrackMuted);
    participant.on(ParticipantEvent.TrackUnmuted, onTrackUnmuted);
    participant.on(ParticipantEvent.IsSpeakingChanged, onIsSpeakingChanged);

    // Cleanup
    return () => {
      participant.off(ParticipantEvent.TrackPublished, updateVideoPublication);
      participant.off(ParticipantEvent.TrackUnpublished, updateVideoPublication);
      participant.off(ParticipantEvent.TrackSubscribed, updateVideoPublication);
      participant.off(ParticipantEvent.TrackUnsubscribed, updateVideoPublication);
      participant.off(ParticipantEvent.TrackMuted, onTrackMuted);
      participant.off(ParticipantEvent.TrackUnmuted, onTrackUnmuted);
      participant.off(ParticipantEvent.IsSpeakingChanged, onIsSpeakingChanged);
    };
  }, [participant]);

  // Effect to attach video track
  useEffect(() => {
    const track = videoPublication?.track;
    if (track && videoRef.current) {
      track.attach(videoRef.current);
      return () => {
        track.detach();
      };
    }
  }, [videoPublication]);

  // Effect to attach audio track
  useEffect(() => {
    const track = audioPublication?.track;
    if (track && audioRef.current) {
      track.attach(audioRef.current);
      return () => {
        track.detach();
      };
    }
  }, [audioPublication]);

  // Decide whether to show video or the placeholder
  // For local participants, we don't need to check isSubscribed
  const shouldShowVideo = videoPublication && videoPublication.track && (participant.isLocal || videoPublication.isSubscribed) && !isCameraMuted;

  return (
    <div
      className={`relative h-full w-full bg-feather-green overflow-hidden ${
        isSpeaking ? 'ring-4 ring-blue-500 ring-opacity-75' : ''
      }`}
      data-lk-local-participant={participant.isLocal}
    >
      {shouldShowVideo ? (
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          style={participant.isLocal ? { transform: 'scaleX(-1)' } : {}}
          autoPlay
          playsInline
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center">
          <div className="bg-snow flex items-center justify-center text-eel font-bold w-32 h-32 text-4xl relative">
            {isCameraMuted && (
               <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                 <VideoCameraSlashIcon className="h-16 w-16 text-white" />
               </div>
            )}
            {!isCameraMuted && getInitials(participant.identity)}
          </div>
        </div>
      )}

      <audio
        ref={audioRef}
        autoPlay
        playsInline
        muted={participant.isLocal}
      />

      <div className="absolute bottom-3 left-3 bg-black/40 px-2 py-1">
        <h3 className="text-snow font-medium text-sm">
          {cleanName(participant.identity)}
        </h3>
      </div>
    </div>
  );
}