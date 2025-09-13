'use client';

import { Room, Track, RoomEvent } from 'livekit-client';
import React, { useEffect, useRef, useState, useCallback } from 'react';

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
  const [connectionStatus, setConnectionStatus] = useState('initializing');
  const [debugInfo, setDebugInfo] = useState('Starting...');
  const [audioDataCount, setAudioDataCount] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const setupAttemptRef = useRef<number>(0);
  const isSetupInProgressRef = useRef<boolean>(false);

  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up LiveAssistant resources');

    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus('disconnected');
    isSetupInProgressRef.current = false;
  }, []);

  const setupWebSocket = useCallback(async (): Promise<WebSocket | null> => {
    return new Promise((resolve) => {
      console.log('🔌 Setting up WebSocket connection');
      const ws = new WebSocket(`${BACKEND_URL}/ws/transcribe`);

      const timeoutId = setTimeout(() => {
        console.log('❌ WebSocket connection timeout');
        setConnectionStatus('error');
        setDebugInfo('Connection timeout');
        ws.close();
        resolve(null);
      }, 10000); // 10 second timeout

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        clearTimeout(timeoutId);
        setIsConnected(true);
        setConnectionStatus('active');
        setDebugInfo('WebSocket connected');
        resolve(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data: AnalysisData = JSON.parse(event.data);

          if (data.type === 'error') {
            console.error('❌ Backend error:', data.message);
            setConnectionStatus('error');
            setDebugInfo(`Backend error: ${data.message}`);
            return;
          }

          if (data.type === 'partial') {
            setPartialTranscript(data.transcript || '');
            setDebugInfo('Receiving partial transcript');
          } else if (data.type === 'final') {
            console.log('📝 Final transcript:', data.transcript);
            setAnalysis(data);
            setPartialTranscript('');
            setDebugInfo(`Final: ${data.transcript?.substring(0, 20)}...`);

            if (data.animation_trigger) {
              console.log(`🎭 Animation trigger: ${data.animation_trigger}`);
              setCurrentAnimation(data.animation_trigger);

              if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
              }

              animationTimeoutRef.current = setTimeout(() => {
                setCurrentAnimation('idle');
              }, 3000);
            }
          }
        } catch (e) {
          console.error('❌ Error parsing WebSocket message:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        clearTimeout(timeoutId);
        setConnectionStatus('error');
        setDebugInfo('WebSocket error');
        resolve(null);
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        clearTimeout(timeoutId);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        setDebugInfo('WebSocket disconnected');
      };
    });
  }, []);

  const setupAudioProcessing = useCallback(async () => {
    if (isSetupInProgressRef.current) {
      console.log('⏳ Audio setup already in progress');
      return;
    }

    isSetupInProgressRef.current = true;
    setupAttemptRef.current += 1;
    const attemptNumber = setupAttemptRef.current;

    console.log(`🎤 Setting up audio processing (attempt ${attemptNumber})`);

    try {
      // Check room connection
      if (room.state !== 'connected') {
        console.log(`⏳ Room not connected (${room.state}), waiting...`);
        setDebugInfo(`Room: ${room.state}`);
        setConnectionStatus('waiting_for_room');
        isSetupInProgressRef.current = false;

        setTimeout(() => setupAudioProcessing(), 2000);
        return;
      }

      console.log('✅ Room connected, looking for audio tracks');
      setDebugInfo('Room connected, finding audio...');

      // Get all audio tracks
      const allTracks = Array.from(room.localParticipant.trackPublications.values());
      const audioTracks = allTracks.filter(pub => pub.kind === 'audio');

      console.log('📋 All tracks:', allTracks.map(t => ({ name: t.trackName, kind: t.kind, source: t.source })));
      console.log('🎵 Audio tracks found:', audioTracks.length);

      if (audioTracks.length === 0) {
        console.log('❌ No audio tracks found');
        setDebugInfo('No audio tracks found');
        setConnectionStatus('waiting_for_mic');
        isSetupInProgressRef.current = false;

        if (attemptNumber < 10) { // Limit retry attempts
          setTimeout(() => setupAudioProcessing(), 3000);
        }
        return;
      }

      // Use the first available audio track
      const audioTrack = audioTracks[0];
      console.log('🎤 Using audio track:', {
        name: audioTrack.trackName,
        kind: audioTrack.kind,
        source: audioTrack.source
      });

      if (!audioTrack.track || !audioTrack.track.mediaStreamTrack) {
        setDebugInfo('Audio track not ready');
        isSetupInProgressRef.current = false;

        if (attemptNumber < 10) {
          setTimeout(() => setupAudioProcessing(), 2000);
        }
        return;
      }

      const mediaStreamTrack = audioTrack.track.mediaStreamTrack;
      console.log('📊 Track details:', {
        label: mediaStreamTrack.label,
        enabled: mediaStreamTrack.enabled,
        readyState: mediaStreamTrack.readyState,
        settings: mediaStreamTrack.getSettings()
      });

      setDebugInfo(`Using: ${mediaStreamTrack.label}`);
      setConnectionStatus('initializing');

      // Create AudioContext
      console.log('🎚️ Creating AudioContext');
      const context = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = context;

      // Load audio worklet
      try {
        console.log('⚙️ Loading audio worklet');
        await context.audioWorklet.addModule('/audio-processor.js');
        console.log('✅ Audio worklet loaded');
      } catch (e) {
        console.error('❌ Error loading audio worklet:', e);
        setConnectionStatus('error');
        setDebugInfo('Worklet load failed');
        isSetupInProgressRef.current = false;
        return;
      }

      // Setup WebSocket
      console.log('🔌 Setting up WebSocket');
      const ws = await setupWebSocket();
      if (!ws) {
        console.log('❌ WebSocket setup failed');
        isSetupInProgressRef.current = false;
        return;
      }
      socketRef.current = ws;

      // Create audio worklet node
      console.log('🎛️ Creating audio worklet node');
      const workletNode = new AudioWorkletNode(context, 'audio-processor');
      workletNodeRef.current = workletNode;

      // Setup message handler from worklet
      workletNode.port.onmessage = (event) => {
        if (ws.readyState === WebSocket.OPEN && event.data.type === 'audio') {
          const audioData = event.data.data;
          console.log(`📤 Sending audio chunk: ${audioData.byteLength} bytes`);
          setAudioDataCount(prev => prev + 1);
          ws.send(audioData);
        }
      };

      // Connect audio nodes
      console.log('🔗 Connecting audio nodes');
      const mediaStreamSource = context.createMediaStreamSource(
        new MediaStream([mediaStreamTrack])
      );

      mediaStreamSource.connect(workletNode);
      // Note: Don't connect to destination to avoid feedback

      console.log('✅ Audio processing setup complete');
      setConnectionStatus('active');
      setDebugInfo('Recording active');
      isSetupInProgressRef.current = false;

    } catch (error) {
      console.error('❌ Error setting up audio processing:', error);
      setConnectionStatus('error');
      setDebugInfo(`Setup error: ${error}`);
      isSetupInProgressRef.current = false;
    }
  }, [room, setupWebSocket]);

  // Effect to handle room events and setup
  useEffect(() => {
    console.log('🚀 LiveAssistant mounting');

    const handleTrackPublished = (publication: any) => {
      console.log('📡 Track published:', publication.trackName, publication.kind);
      if (publication.kind === 'audio') {
        console.log('🎤 Audio track published, setting up processing');
        setTimeout(() => setupAudioProcessing(), 500);
      }
    };

    const handleTrackUnpublished = (publication: any) => {
      console.log('📡 Track unpublished:', publication.trackName, publication.kind);
      if (publication.kind === 'audio') {
        setDebugInfo('Audio track unpublished');
        setConnectionStatus('waiting_for_mic');
      }
    };

    const handleRoomStateChanged = () => {
      console.log('🏠 Room connected');
      setTimeout(() => setupAudioProcessing(), 1000);
    };

    // Add event listeners
    room.localParticipant.on(RoomEvent.TrackPublished, handleTrackPublished);
    room.localParticipant.on(RoomEvent.TrackUnpublished, handleTrackUnpublished);
    room.on(RoomEvent.Connected, handleRoomStateChanged);

    // Initial setup attempt
    setTimeout(() => setupAudioProcessing(), 2000);

    // Cleanup function
    return () => {
      console.log('🧹 LiveAssistant unmounting');
      room.localParticipant.off(RoomEvent.TrackPublished, handleTrackPublished);
      room.localParticipant.off(RoomEvent.TrackUnpublished, handleTrackUnpublished);
      room.off(RoomEvent.Connected, handleRoomStateChanged);
      cleanup();
    };
  }, [room, setupAudioProcessing, cleanup]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'active': return 'bg-green-500';
      case 'initializing':
      case 'waiting_for_mic':
      case 'waiting_for_room': return 'bg-yellow-500';
      case 'error':
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'active': return 'Active';
      case 'initializing': return 'Initializing...';
      case 'waiting_for_mic': return 'Waiting for mic...';
      case 'waiting_for_room': return 'Waiting for room...';
      case 'error': return 'Error';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  };

  return (
    <div className="fixed bottom-24 right-8 z-50 p-4 bg-white/90 backdrop-blur-md rounded-lg shadow-lg max-w-sm min-w-[300px]">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
        <p className="font-bold text-gray-800">Live Assistant</p>
        <span className="text-xs text-gray-600">({getStatusText()})</span>
      </div>

      {/* Animation Display & Debugging */}
      <div className="text-center mb-3 p-3 bg-gray-100 rounded-lg">
        <p className="text-sm font-semibold text-gray-700">Emotion from LLM:</p>
        <p className="text-2xl font-mono font-bold text-blue-600">{currentAnimation}</p>
        <div className="text-xs text-gray-500 mt-2">
          <p>Audio chunks: {audioDataCount}</p>
          <p>{debugInfo}</p>
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
          Connection error. Check console for details.
        </div>
      )}
    </div>
  );
}