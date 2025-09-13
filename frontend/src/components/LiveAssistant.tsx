'use client';

import { Room, RoomEvent, TrackPublication } from 'livekit-client';
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
  : 'wss://361c01c7de59.ngrok-free.app';

// Fallback WebSocket URL (can be set via environment variable)
const BACKEND_FALLBACK = process.env.NEXT_PUBLIC_BACKEND_FALLBACK_URL
  ? process.env.NEXT_PUBLIC_BACKEND_FALLBACK_URL.replace(/^http/, 'ws')
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
      
      // Try primary WebSocket endpoint first
      const tryPrimary = () => {
        const ws = new WebSocket(`${BACKEND_URL}/ws/transcribe`);
        
        const primaryTimeout = setTimeout(() => {
          console.log('Primary WebSocket timeout, trying fallback...');
          ws.close();
          tryFallback();
        }, 5000);
        
        ws.onopen = () => {
          clearTimeout(primaryTimeout);
          console.log('✅ Primary WebSocket connected');
          setupWebSocketHandlers(ws, resolve);
        };
        
        ws.onerror = () => {
          clearTimeout(primaryTimeout);
          console.log('Primary WebSocket failed, trying fallback...');
          tryFallback();
        };
      };
      
      // Fallback WebSocket endpoint
      const tryFallback = () => {
        const ws = new WebSocket(`${BACKEND_FALLBACK}/ws/transcribe`);
        
        const fallbackTimeout = setTimeout(() => {
          console.log('❌ Fallback WebSocket timeout');
          setConnectionStatus('error');
          setDebugInfo('Connection timeout');
          resolve(null);
        }, 5000);
        
        ws.onopen = () => {
          clearTimeout(fallbackTimeout);
          console.log('✅ Fallback WebSocket connected');
          setupWebSocketHandlers(ws, resolve);
        };
        
        ws.onerror = () => {
          clearTimeout(fallbackTimeout);
          console.log('❌ Both WebSocket endpoints failed');
          setConnectionStatus('error');
          setDebugInfo('Connection failed');
          resolve(null);
        };
      };
      
      // Helper function to setup WebSocket handlers
      const setupWebSocketHandlers = (ws: WebSocket, resolve: (value: WebSocket | null) => void) => {
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

              // Dispatch custom event for ReactionBox
              const emotionEvent = new CustomEvent('emotion-change', {
                detail: data.animation_trigger
              });
              window.dispatchEvent(emotionEvent);

              if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
              }

              animationTimeoutRef.current = setTimeout(() => {
                setCurrentAnimation('idle');
                // Dispatch idle event
                const idleEvent = new CustomEvent('emotion-change', {
                  detail: 'idle'
                });
                window.dispatchEvent(idleEvent);
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
      };
      
      // Start connection attempt with primary endpoint
      tryPrimary();
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

      // Resume context if it's in a suspended state (browser security)
      if (context.state === 'suspended') {
        console.log('AudioContext is suspended, attempting to resume...');
        await context.resume();
      }

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

    const handleTrackPublished = (publication: TrackPublication) => {
      console.log('📡 Track published:', publication.trackName, publication.kind);
      if (publication.kind === 'audio') {
        console.log('🎤 Audio track published, setting up processing');
        setTimeout(() => setupAudioProcessing(), 500);
      }
    };

    const handleTrackUnpublished = (publication: TrackPublication) => {
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
    <div className="window" style={{ 
      position: 'fixed', 
      bottom: '100px', 
      right: '20px', 
      zIndex: 50, 
      maxWidth: '320px',
      minWidth: '300px'
    }}>
      <div className="title-bar">
        <div className="title-bar-text">Live Assistant</div>
        <div className="title-bar-controls">
          <button aria-label="Minimize"></button>
        </div>
      </div>
      <div className="window-body" style={{ padding: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div style={{ 
            width: '8px', 
            height: '8px', 
            backgroundColor: getStatusColor() === 'bg-green-500' ? '#008000' : 
                           getStatusColor() === 'bg-yellow-500' ? '#808000' : '#800000'
          }}></div>
          <span style={{ fontSize: '11px' }}>({getStatusText()})</span>
        </div>

        {/* Animation Display & Debugging */}
        <div className="sunken-panel" style={{ 
          textAlign: 'center', 
          marginBottom: '8px', 
          padding: '8px',
          backgroundColor: '#c0c0c0'
        }}>
          <p style={{ fontSize: '11px', fontWeight: 'bold' }}>Emotion from LLM:</p>
          <p style={{ fontSize: '16px', fontFamily: 'monospace', fontWeight: 'bold', color: '#000080' }}>
            {currentAnimation}
          </p>
          <div style={{ fontSize: '9px', color: '#666', marginTop: '4px' }}>
            <p>Audio chunks: {audioDataCount}</p>
            <p>{debugInfo}</p>
          </div>
        </div>

        {/* Transcript Display */}
        <div style={{ marginBottom: '8px' }}>
          <div className="sunken-panel" style={{ 
            fontSize: '11px', 
            minHeight: '50px', 
            maxHeight: '80px', 
            overflowY: 'auto', 
            padding: '4px',
            backgroundColor: 'white'
          }}>
            {partialTranscript && (
              <p style={{ color: '#666', fontStyle: 'italic', marginBottom: '4px' }}>
                {partialTranscript}...
              </p>
            )}
            {analysis?.transcript && (
              <p style={{ color: '#000', fontWeight: 'bold' }}>{analysis.transcript}</p>
            )}
            {!partialTranscript && !analysis?.transcript && (
              <p style={{ color: '#999' }}>Listening...</p>
            )}
          </div>
        </div>

        {/* Metrics Display */}
        {analysis?.metrics && connectionStatus === 'active' && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '4px', 
            fontSize: '10px' 
          }}>
            <div className="sunken-panel" style={{ padding: '4px', backgroundColor: '#e0e0ff' }}>
              <div style={{ fontWeight: 'bold', color: '#000080' }}>WPM</div>
              <div style={{ fontSize: '14px', fontFamily: 'monospace' }}>{analysis.metrics.wpm}</div>
            </div>
            <div className="sunken-panel" style={{ padding: '4px', backgroundColor: '#e0ffe0' }}>
              <div style={{ fontWeight: 'bold', color: '#008000' }}>Clarity</div>
              <div style={{ fontSize: '14px', fontFamily: 'monospace' }}>{analysis.metrics.clarity_score}%</div>
            </div>
            <div className="sunken-panel" style={{ padding: '4px', backgroundColor: '#ffe0e0' }}>
              <div style={{ fontWeight: 'bold', color: '#800000' }}>Fillers</div>
              <div style={{ fontSize: '14px', fontFamily: 'monospace' }}>{analysis.metrics.filler_words}</div>
            </div>
            <div className="sunken-panel" style={{ padding: '4px', backgroundColor: '#f0e0ff' }}>
              <div style={{ fontWeight: 'bold', color: '#800080' }}>Words</div>
              <div style={{ fontSize: '14px', fontFamily: 'monospace' }}>{analysis.metrics.word_count}</div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {connectionStatus === 'error' && (
          <div style={{ fontSize: '10px', color: '#800000', backgroundColor: '#ffe0e0', padding: '4px', marginTop: '4px' }}>
            Connection error. Check console for details.
          </div>
        )}
      </div>
    </div>
  );
}