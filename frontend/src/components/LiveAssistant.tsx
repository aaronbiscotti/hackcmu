'use client';

import { Room, Track } from 'livekit-client';
import React, { useEffect, useRef, useState } from 'react';

// Define the structure of the data received from the backend
interface AnalysisData {
  type: 'final' | 'partial' | 'error';
  transcript?: string;
  metrics?: {
    wpm: number;
    filler_words: number;
    clarity_score: number;
    word_count: number;
  };
  animation_trigger?: string;
  timestamp?: number;
  message?: string;
}

interface LiveAssistantProps {
  room: Room;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL
  ? process.env.NEXT_PUBLIC_BACKEND_URL.replace(/^http/, 'ws')
  : 'ws://localhost:8001';

export default function LiveAssistant({ room }: LiveAssistantProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [currentAnimation, setCurrentAnimation] = useState('idle');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const setupAudioProcessing = async () => {
      try {
        // Get the local participant's microphone track
        const micPublication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (!micPublication?.audioTrack || !micPublication.mediaStreamTrack) {
          console.warn("Microphone track not available yet.");
          setConnectionStatus('waiting_for_mic');
          return;
        }

        setConnectionStatus('initializing');

        // 1. Create AudioContext with 16kHz sample rate for Vosk
        const context = new AudioContext({ sampleRate: 16000 });
        audioContextRef.current = context;

        try {
          await context.audioWorklet.addModule('/audio-processor.js');
        } catch (e) {
          console.error('Error loading audio worklet:', e);
          setConnectionStatus('error');
          return;
        }

        // 2. Create the WebSocket connection
        const ws = new WebSocket(`${BACKEND_URL}/ws/transcribe`);
        socketRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
          setConnectionStatus('active');
        };

        ws.onmessage = (event) => {
          try {
            const data: AnalysisData = JSON.parse(event.data);

            if (data.type === 'error') {
              console.error('Backend error:', data.message);
              setConnectionStatus('error');
              return;
            }

            if (data.type === 'partial') {
              setPartialTranscript(data.transcript || '');
            } else if (data.type === 'final') {
              setAnalysis(data);
              setPartialTranscript(''); // Clear partial transcript

              if (data.animation_trigger) {
                console.log(`Triggering animation: ${data.animation_trigger}`);
                setCurrentAnimation(data.animation_trigger);

                // Clear any existing timeout
                if (animationTimeoutRef.current) {
                  clearTimeout(animationTimeoutRef.current);
                }

                // Return to idle animation after a delay
                animationTimeoutRef.current = setTimeout(() => {
                  setCurrentAnimation('idle');
                }, 3000);
              }
            }
          } catch (e) {
            console.error('Error parsing WebSocket message:', e);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnectionStatus('error');
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
          setConnectionStatus('disconnected');
        };

        // 3. Connect the microphone stream to the worklet
        const mediaStreamSource = context.createMediaStreamSource(
          new MediaStream([micPublication.mediaStreamTrack])
        );
        const workletNode = new AudioWorkletNode(context, 'audio-processor');
        workletNodeRef.current = workletNode;

        // 4. Set up the message handler from the worklet
        workletNode.port.onmessage = (event) => {
          if (ws.readyState === WebSocket.OPEN && event.data.type === 'audio') {
            ws.send(event.data.data);
          }
        };

        // Connect audio nodes
        mediaStreamSource.connect(workletNode);
        // Note: Don't connect to destination to avoid audio feedback

        setConnectionStatus('active');
      } catch (error) {
        console.error('Error setting up audio processing:', error);
        setConnectionStatus('error');
      }
    };

    // Wait a bit for the room to be fully connected before setting up audio
    const timer = setTimeout(setupAudioProcessing, 1000);

    // Cleanup function
    return () => {
      clearTimeout(timer);
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      socketRef.current?.close();
      audioContextRef.current?.close();
    };
  }, [room]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'active': return 'bg-green-500';
      case 'connecting':
      case 'initializing':
      case 'waiting_for_mic': return 'bg-yellow-500';
      case 'error':
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'active': return 'Active';
      case 'connecting': return 'Connecting...';
      case 'initializing': return 'Initializing...';
      case 'waiting_for_mic': return 'Waiting for mic...';
      case 'error': return 'Error';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  };

  return (
    <div className="fixed bottom-24 left-8 z-50 p-4 bg-white/90 backdrop-blur-md rounded-lg shadow-lg max-w-sm min-w-[300px]">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
        <p className="font-bold text-gray-800">Live Assistant</p>
        <span className="text-xs text-gray-600">({getStatusText()})</span>
      </div>

      {/* Animation Display */}
      <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full mx-auto mb-3 flex items-center justify-center border-2 border-blue-200">
        <div className="text-center">
          <div className="text-lg mb-1">
            {currentAnimation === 'idle' && '😐'}
            {currentAnimation === 'speaking' && '🗣️'}
            {currentAnimation === 'question' && '🤔'}
            {currentAnimation === 'nodding' && '😊'}
            {currentAnimation === 'shaking_head' && '😕'}
            {currentAnimation === 'excited' && '🤩'}
            {currentAnimation === 'thinking' && '💭'}
            {currentAnimation === 'confused' && '😵'}
          </div>
          <div className="text-xs text-gray-600 font-mono">{currentAnimation}</div>
        </div>
      </div>

      {/* Transcript Display */}
      <div className="mb-3">
        <div className="text-sm text-gray-600 min-h-[50px] max-h-[80px] overflow-y-auto border rounded p-2 bg-gray-50">
          {partialTranscript && (
            <p className="text-gray-500 italic mb-1">{partialTranscript}...</p>
          )}
          {analysis?.transcript && (
            <p className="text-gray-800 font-medium">{analysis.transcript}</p>
          )}
          {!partialTranscript && !analysis?.transcript && (
            <p className="text-gray-400">Listening...</p>
          )}
        </div>
      </div>

      {/* Metrics Display */}
      {analysis?.metrics && connectionStatus === 'active' && (
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          <div className="bg-blue-50 p-2 rounded">
            <div className="font-semibold text-blue-700">WPM</div>
            <div className="text-lg font-mono">{analysis.metrics.wpm}</div>
          </div>
          <div className="bg-green-50 p-2 rounded">
            <div className="font-semibold text-green-700">Clarity</div>
            <div className="text-lg font-mono">{analysis.metrics.clarity_score}%</div>
          </div>
          <div className="bg-orange-50 p-2 rounded">
            <div className="font-semibold text-orange-700">Fillers</div>
            <div className="text-lg font-mono">{analysis.metrics.filler_words}</div>
          </div>
          <div className="bg-purple-50 p-2 rounded">
            <div className="font-semibold text-purple-700">Words</div>
            <div className="text-lg font-mono">{analysis.metrics.word_count}</div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {connectionStatus === 'error' && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
          Connection error. Speech recognition may not be available.
        </div>
      )}
    </div>
  );
}